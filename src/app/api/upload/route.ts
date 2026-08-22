/**
 * POST /api/upload
 * Upload image to storage with strict processing pipeline
 * 
 * Features:
 * - Accepts JPEG, PNG, WebP, HEIC, HEIF
 * - Converts all to WebP
 * - Generates responsive sizes
 * - Auto-orients based on EXIF
 * - Automatically registers in MediaAsset registry
 */

import { NextRequest, NextResponse } from "next/server";

// Force Node.js runtime for sharp support
export const runtime = 'nodejs';

// Set max duration for processing (30 seconds)
export const maxDuration = 30;

// Note: Body size limit is configured in next.config.ts
// For App Router, use: experimental.serverActions.bodySizeLimit
import { getCurrentUser } from "@/lib/auth/server";
import {
  detectUploadMimeTypeFromBuffer,
  resolveUploadMimeType,
} from "@/lib/uploads/uploadConfig";
import { jsonUploadError } from "@/lib/uploads/uploadErrors";
import type { UploadSuccessResponse } from "@/lib/uploads/uploadTypes";
import { validateUploadPreflight } from "@/lib/uploads/validateUploadPreflight";
import { resolveUploadOwnerUserId, UploadOwnerOverrideError, type UploadContext } from "@/lib/uploads/resolveUploadOwner";
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import {
  contentHashOf,
  findOwnedMediaByContentHash,
  buildDedupUploadResponse,
} from "@/lib/media/dedup";
import { MediaSourceType } from "@prisma/client";
import {
  processImage,
  generateProcessedFilename,
  DEFAULT_IMAGE_CONFIG,
} from "@/lib/media/imageProcessor";
import {
  MEDIA_STORAGE_ROOT,
  MEDIA_UPLOADS_DIR,
  writeRuntimeUpload,
} from "@/server/media/media-storage";

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

    // ownerUserId lets ADMIN/MODERATOR attribute an upload to another user's
    // media library, but only inside the ADMIN_ARTICLE context (article
    // editor uploading into the article's author's library) — plain callers
    // (business wizard, avatar, etc.) never send either field, so they keep
    // uploadedById = user.id unconditionally. Never trust the client's role
    // or context claim on their own — both are re-checked server-side below.
    const requestedOwnerUserId = (formData.get("ownerUserId") as string | null)?.trim() || null;
    const rawUploadContext = (formData.get("uploadContext") as string | null)?.trim() || null;
    const uploadContext: UploadContext | null = rawUploadContext === "ADMIN_ARTICLE" ? "ADMIN_ARTICLE" : null;
    let ownerUserId: string;
    try {
      ownerUserId = await resolveUploadOwnerUserId({
        requesterId: user.id,
        requesterRole: user.role,
        requestedOwnerUserId,
        uploadContext,
      });
    } catch (error) {
      if (error instanceof UploadOwnerOverrideError) {
        return jsonUploadError(error.code, error.message, error.code === "FORBIDDEN" ? 403 : 400);
      }
      throw error;
    }

    console.log("[UPLOAD] Incoming file", {
      userId: user.id,
      role: user.role,
      ownerUserId,
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
    const existingByHash = await findOwnedMediaByContentHash(ownerUserId, contentHash);
    if (existingByHash) {
      console.log("[UPLOAD] Dedup hit — reusing existing asset", {
        userId: user.id,
        ownerUserId,
        mediaId: existingByHash.id,
      });
      return NextResponse.json(buildDedupUploadResponse(existingByHash));
    }

    const actualMimeType =
      detectUploadMimeTypeFromBuffer(buffer) ??
      resolveUploadMimeType(file) ??
      file.type;

    console.log("[UPLOAD] Buffer created", {
      userId: user.id,
      bufferSize: buffer.length,
      detectedMimeType: actualMimeType,
    });

    console.log("[UPLOAD] Starting image processing", {
      userId: user.id,
      mimeType: actualMimeType,
    });
    let processedImageSet;
    try {
      processedImageSet = await processImage(
        buffer,
        actualMimeType,
        DEFAULT_IMAGE_CONFIG
      );
      console.log("[UPLOAD] Image processed successfully", {
        userId: user.id,
        originalFormat: processedImageSet.originalMimeType,
        masterSize: processedImageSet.master.size,
        masterDimensions: `${processedImageSet.master.width}x${processedImageSet.master.height}`,
        responsiveSizes: Object.keys(processedImageSet.sizes),
      });
    } catch (processingError: unknown) {
      const message = processingError instanceof Error ? processingError.message : "Image processing failed";
      console.error("[UPLOAD] Processing failed", {
        userId: user.id,
        error: message,
        fileType: file.type,
        fileName: file.name,
      });
      return jsonUploadError("IMAGE_PROCESSING_FAILED", message, 400);
    }

    let masterFilename = "";
    let masterUrl = "";
    const responsiveSizes: Record<string, string> = {};
    try {
      const masterSaved = await writeRuntimeUpload(
        generateProcessedFilename(file.name),
        processedImageSet.master.buffer,
      );
      masterFilename = masterSaved.filename;
      masterUrl = masterSaved.publicUrl;

      console.log("[UPLOAD] Master file saved", {
        userId: user.id,
        savedPath: masterSaved.absolutePath,
        publicUrl: masterSaved.publicUrl,
      });

      for (const [sizeName, sizeData] of Object.entries(processedImageSet.sizes)) {
        if (!sizeData) continue;
        const sizeSaved = await writeRuntimeUpload(
          generateProcessedFilename(file.name, sizeName),
          sizeData.buffer,
        );
        responsiveSizes[sizeName] = sizeSaved.publicUrl;
      }
    } catch (storageError) {
      const message = storageError instanceof Error ? storageError.message : "Failed to write uploaded file";
      console.error("[UPLOAD] Storage write failed", {
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
        uploadedById: ownerUserId,
        contentHash,
      });
      mediaId = asset.id;
    } catch (mediaError) {
      const message = mediaError instanceof Error ? mediaError.message : "Failed to register media in database";
      console.error("[UPLOAD] Database write failed", {
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
    console.error("[UPLOAD] Unexpected error", { error: message });
    return jsonUploadError("UPLOAD_FAILED", message, 500);
  }
}
