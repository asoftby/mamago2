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
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import { MediaSourceType } from "@prisma/client";
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

    // STEP 1: Log incoming file details
    console.log("📥 [UPLOAD] Incoming file:", {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeKB: (file.size / 1024).toFixed(2) + " KB",
    });

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // STEP 2: Log buffer conversion and detect actual format
    // Check magic bytes for HEIC/HEIF (starts with "ftyp")
    const magicBytes = buffer.slice(4, 8).toString('ascii');
    const isLikelyHEIC = magicBytes === 'ftyp' || 
                         buffer.slice(8, 12).toString('ascii') === 'heic' ||
                         buffer.slice(8, 12).toString('ascii') === 'mif1';
    
    console.log("📦 [UPLOAD] Buffer created:", {
      bufferSize: buffer.length,
      matches: buffer.length === file.size,
      magicBytes: magicBytes,
      isLikelyHEIC: isLikelyHEIC,
    });
    
    // Override MIME type if we detect HEIC by magic bytes
    let actualMimeType = file.type;
    if (isLikelyHEIC && !file.type.includes('heic') && !file.type.includes('heif')) {
      console.log("⚠️  [UPLOAD] Detected HEIC by magic bytes, overriding MIME type");
      actualMimeType = 'image/heic';
    }

    // STEP 3: Process image through strict pipeline
    console.log("🔄 [UPLOAD] Starting image processing with MIME type:", actualMimeType);
    let processedImageSet;
    try {
      processedImageSet = await processImage(
        buffer,
        actualMimeType,
        DEFAULT_IMAGE_CONFIG
      );
      console.log("✅ [UPLOAD] Image processed successfully:", {
        originalFormat: processedImageSet.originalMimeType,
        masterSize: processedImageSet.master.size,
        masterDimensions: `${processedImageSet.master.width}x${processedImageSet.master.height}`,
        responsiveSizes: Object.keys(processedImageSet.sizes),
      });
    } catch (processingError: unknown) {
      const message = processingError instanceof Error ? processingError.message : "Image processing failed";
      console.error("❌ [UPLOAD] Processing failed:", {
        error: message,
        fileType: file.type,
        fileName: file.name,
      });
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Save master image (WebP)
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
      });
      mediaId = asset.id;
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
      mediaId,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
