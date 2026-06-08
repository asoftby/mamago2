/**
 * POST /api/upload/wizard
 * Upload image for wizard session (creates TEMP MediaAsset)
 * 
 * Features:
 * - Same processing pipeline as /api/upload
 * - Creates MediaAsset with status=TEMP
 * - Associates with wizardSessionId
 * - Will be committed to ACTIVE when entity is published
 * - Auto-cleaned if wizard is abandoned
 */

import { NextRequest, NextResponse } from "next/server";

// Force Node.js runtime for sharp support
export const runtime = 'nodejs';

// Set max duration for processing (30 seconds)
export const maxDuration = 30;

import { getCurrentUser } from "@/lib/auth/server";
import {
  detectUploadMimeTypeFromBuffer,
  resolveUploadMimeType,
} from "@/lib/uploads/uploadConfig";
import { jsonUploadError } from "@/lib/uploads/uploadErrors";
import type { UploadSuccessResponse } from "@/lib/uploads/uploadTypes";
import { validateUploadPreflight } from "@/lib/uploads/validateUploadPreflight";
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
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
    const wizardSessionId = formData.get("wizardSessionId") as string | null;
    const draftEntityId = formData.get("draftEntityId") as string | null;
    const draftEntityType = formData.get("draftEntityType") as string | null;

    if (!(file instanceof File)) {
      return jsonUploadError("FILE_REQUIRED", "Upload request must include a file field", 400);
    }

    if (!wizardSessionId) {
      return jsonUploadError(
        "WIZARD_SESSION_REQUIRED",
        "wizardSessionId is required for wizard uploads",
        400,
      );
    }

    console.log("[WIZARD UPLOAD] Incoming file", {
      userId: user.id,
      role: user.role,
      name: file.name,
      type: file.type,
      size: file.size,
      wizardSessionId,
      draftEntityId,
      draftEntityType,
      targetStorageRoot: MEDIA_STORAGE_ROOT,
      targetUploadDir: MEDIA_UPLOADS_DIR,
    });

    const preflightError = validateUploadPreflight(file);
    if (preflightError) {
      return preflightError;
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const actualMimeType =
      detectUploadMimeTypeFromBuffer(buffer) ??
      resolveUploadMimeType(file) ??
      file.type;

    console.log("[WIZARD UPLOAD] Starting image processing", {
      userId: user.id,
      wizardSessionId,
      mimeType: actualMimeType,
    });
    let processedImageSet;
    try {
      processedImageSet = await processImage(
        buffer,
        actualMimeType,
        DEFAULT_IMAGE_CONFIG
      );
      console.log("[WIZARD UPLOAD] Image processed successfully", {
        userId: user.id,
        wizardSessionId,
        originalFormat: processedImageSet.originalMimeType,
      });
    } catch (processingError: unknown) {
      const message = processingError instanceof Error ? processingError.message : "Image processing failed";
      console.error("[WIZARD UPLOAD] Processing failed", {
        userId: user.id,
        wizardSessionId,
        error: message,
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

      console.log("[WIZARD UPLOAD] Master file saved", {
        userId: user.id,
        wizardSessionId,
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
      console.error("[WIZARD UPLOAD] Storage write failed", {
        userId: user.id,
        wizardSessionId,
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
        mimeType: "image/webp",
        sizeBytes: processedImageSet.master.size,
        width: processedImageSet.master.width,
        height: processedImageSet.master.height,
        storageKey: masterUrl,
        publicUrl: masterUrl,
        sourceType,
        uploadedById: user.id,
        // TEMP media fields
        status: "TEMP",
        wizardSessionId,
        draftEntityId: draftEntityId || undefined,
        draftEntityType: draftEntityType || undefined,
      });
      mediaId = asset.id;

      console.log("[WIZARD UPLOAD] Registered as TEMP MediaAsset", {
        mediaId,
        wizardSessionId,
        draftEntityId,
        draftEntityType,
      });
    } catch (mediaError) {
      const message = mediaError instanceof Error ? mediaError.message : "Failed to register media in database";
      console.error("[WIZARD UPLOAD] Database write failed", {
        userId: user.id,
        wizardSessionId,
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
      status: "TEMP",
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
      status: "TEMP",
      wizardSessionId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload file";
    console.error("[WIZARD UPLOAD] Unexpected error", { error: message });
    return jsonUploadError("UPLOAD_FAILED", message, 500);
  }
}
