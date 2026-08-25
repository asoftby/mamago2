/**
 * POST /api/upload/v2
 * 
 * Strict image ingestion pipeline with:
 * - Format validation (JPEG, PNG, WebP, HEIC, HEIF)
 * - Automatic processing and optimization
 * - WebP conversion
 * - Responsive size generation
 * - Media library registration
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import {
  contentHashOf,
  findOwnedMediaByContentHash,
  buildDedupUploadResponse,
} from "@/lib/media/dedup";
import { MediaSourceType } from "@prisma/client";
import {
  detectUploadMimeTypeFromBuffer,
  resolveUploadMimeType,
} from "@/lib/uploads/uploadConfig";
import { jsonUploadError } from "@/lib/uploads/uploadErrors";
import { validateUploadPreflight } from "@/lib/uploads/validateUploadPreflight";
import {
  processImage,
  DEFAULT_IMAGE_CONFIG,
} from "@/lib/media/imageProcessor";
import { buildMasterFilename, buildMediaStem, buildResponsiveFilename } from "@/server/media/mediaNaming";
import {
  MEDIA_STORAGE_ROOT,
  MEDIA_UPLOADS_DIR,
  writeRuntimeUpload,
} from "@/server/media/media-storage";
import type { UploadSuccessResponse } from "@/lib/uploads/uploadTypes";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return jsonUploadError("UNAUTHORIZED", "Authentication is required to upload media", 401);
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonUploadError("FILE_REQUIRED", "Upload request must include a file field", 400);
    }

    console.log("[UPLOAD V2] Incoming file", {
      userId: user.id,
      role: user.role,
      name: file.name,
      type: file.type,
      size: file.size,
      targetStorageRoot: MEDIA_STORAGE_ROOT,
      targetUploadDir: MEDIA_UPLOADS_DIR,
    });

    const preflightError = validateUploadPreflight(file);
    if (preflightError) {
      return preflightError;
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Dedup (Phase A): hash the raw original bytes and reuse an owner's existing
    // asset before doing any processing or storage writes.
    const contentHash = contentHashOf(buffer);
    const existingByHash = await findOwnedMediaByContentHash(user.id, contentHash);
    if (existingByHash) {
      console.log("[UPLOAD V2] Dedup hit — reusing existing asset", {
        userId: user.id,
        mediaId: existingByHash.id,
      });
      return NextResponse.json(buildDedupUploadResponse(existingByHash));
    }

    const actualMimeType =
      detectUploadMimeTypeFromBuffer(buffer) ??
      resolveUploadMimeType(file) ??
      file.type;

    let processedImageSet;
    try {
      processedImageSet = await processImage(
        buffer,
        actualMimeType,
        DEFAULT_IMAGE_CONFIG
      );
    } catch (processingError: unknown) {
      const message = processingError instanceof Error ? processingError.message : "Image processing failed";
      return jsonUploadError("IMAGE_PROCESSING_FAILED", message, 400);
    }

    let masterFilename = "";
    let masterUrl = "";
    const responsiveSizes: Record<string, string> = {};
    const uploadStem = buildMediaStem({ type: "CONTEXTLESS" });
    try {
      const masterSaved = await writeRuntimeUpload(
        buildMasterFilename(uploadStem),
        processedImageSet.master.buffer,
      );
      masterFilename = masterSaved.filename;
      masterUrl = masterSaved.publicUrl;

      console.log("[UPLOAD V2] Master file saved", {
        userId: user.id,
        savedPath: masterSaved.absolutePath,
        publicUrl: masterSaved.publicUrl,
      });

      for (const [sizeName, sizeData] of Object.entries(processedImageSet.sizes)) {
        if (!sizeData) continue;
        const sizeSaved = await writeRuntimeUpload(
          buildResponsiveFilename(uploadStem, sizeName),
          sizeData.buffer,
        );
        responsiveSizes[sizeName] = sizeSaved.publicUrl;
      }
    } catch (storageError) {
      const message = storageError instanceof Error ? storageError.message : "Failed to write uploaded file";
      console.error("[UPLOAD V2] Storage write failed", {
        userId: user.id,
        error: message,
        targetStorageRoot: MEDIA_STORAGE_ROOT,
        targetUploadDir: MEDIA_UPLOADS_DIR,
      });
      return jsonUploadError("STORAGE_WRITE_FAILED", message, 500);
    }

    let mediaId: string | null = null;
    try {
      let sourceType: MediaSourceType = MediaSourceType.USER_UPLOAD;
      if (user.role === "ADMIN" || user.role === "MODERATOR") {
        sourceType = MediaSourceType.ADMIN_UPLOAD;
      } else if (user.role === "BUSINESS_OWNER") {
        sourceType = MediaSourceType.BUSINESS_UPLOAD;
      }

      const asset = await registerUploadedMedia({
        filename: masterFilename,
        originalName: file.name,
        mimeType: "image/webp", // All processed images are WebP
        sizeBytes: processedImageSet.master.size,
        width: processedImageSet.master.width,
        height: processedImageSet.master.height,
        storageKey: masterUrl,
        publicUrl: masterUrl,
        sourceType,
        uploadedById: user.id,
        contentHash,
        title: uploadStem,
      });
      mediaId = asset.id;
    } catch (mediaError) {
      const message = mediaError instanceof Error ? mediaError.message : "Failed to register media in database";
      console.error("[UPLOAD V2] Database write failed", {
        userId: user.id,
        error: message,
        fileName: masterFilename,
        publicUrl: masterUrl,
      });
      return jsonUploadError("DATABASE_WRITE_FAILED", message, 500);
    }

    const media: UploadSuccessResponse["media"] = {
      id: mediaId ?? masterFilename,
      url: masterUrl,
      mimeType: "image/webp",
      fileName: masterFilename,
      width: processedImageSet.master.width,
      height: processedImageSet.master.height,
      size: processedImageSet.master.size,
      status: "PERSISTENT",
    };

    return NextResponse.json({
      media,
      id: media.id,
      mediaId,
      url: media.url,
      publicUrl: media.url,
      mimeType: media.mimeType,
      fileName: media.fileName,
      filename: masterFilename,
      size: processedImageSet.master.size,
      width: processedImageSet.master.width,
      height: processedImageSet.master.height,
      format: "webp",
      originalFormat: processedImageSet.originalMimeType,
      responsiveSizes,
      processed: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload file";
    console.error("[UPLOAD V2] Unexpected error", { error: message });
    return jsonUploadError("UPLOAD_FAILED", message, 500);
  }
}
