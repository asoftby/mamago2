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
import { MediaSourceType } from "@prisma/client";
import { validateUploadPreflight } from "@/lib/uploads/validateUploadPreflight";
import {
  processImage,
  generateProcessedFilename,
  DEFAULT_IMAGE_CONFIG,
} from "@/lib/media/imageProcessor";
import { writeRuntimeUpload } from "@/server/media/media-storage";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Preflight validation (before any memory read)
    const preflightError = validateUploadPreflight(file);
    if (preflightError) {
      return preflightError;
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Process image through pipeline
    let processedImageSet;
    try {
      processedImageSet = await processImage(
        buffer,
        file.type,
        DEFAULT_IMAGE_CONFIG
      );
    } catch (processingError: unknown) {
      const message = processingError instanceof Error ? processingError.message : "Image processing failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Save master image
    const masterSaved = await writeRuntimeUpload(
      generateProcessedFilename(file.name),
      processedImageSet.master.buffer,
    );
    const masterFilename = masterSaved.filename;
    const masterUrl = masterSaved.publicUrl;

    // Save responsive sizes
    const responsiveSizes: Record<string, string> = {};
    for (const [sizeName, sizeData] of Object.entries(processedImageSet.sizes)) {
      if (sizeData) {
        const sizeSaved = await writeRuntimeUpload(
          generateProcessedFilename(file.name, sizeName),
          sizeData.buffer,
        );
        responsiveSizes[sizeName] = sizeSaved.publicUrl;
      }
    }

    // Register in media library
    try {
      let sourceType: MediaSourceType = MediaSourceType.USER_UPLOAD;
      if (user.role === "ADMIN" || user.role === "MODERATOR") {
        sourceType = MediaSourceType.ADMIN_UPLOAD;
      } else if (user.role === "BUSINESS_OWNER") {
        sourceType = MediaSourceType.BUSINESS_UPLOAD;
      }

      await registerUploadedMedia({
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
      });
    } catch (mediaError) {
      console.error("Failed to register media in library:", mediaError);
    }

    return NextResponse.json({
      url: masterUrl,
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
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
