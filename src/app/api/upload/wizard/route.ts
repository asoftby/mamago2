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
    const wizardSessionId = formData.get("wizardSessionId") as string | null;
    const draftEntityId = formData.get("draftEntityId") as string | null;
    const draftEntityType = formData.get("draftEntityType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!wizardSessionId) {
      return NextResponse.json({ error: "wizardSessionId is required for wizard uploads" }, { status: 400 });
    }

    console.log("📥 [WIZARD UPLOAD] Incoming file:", {
      name: file.name,
      type: file.type,
      size: file.size,
      wizardSessionId,
      draftEntityId,
      draftEntityType,
    });

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Detect actual format
    const magicBytes = buffer.slice(4, 8).toString('ascii');
    const isLikelyHEIC = magicBytes === 'ftyp' || 
                         buffer.slice(8, 12).toString('ascii') === 'heic' ||
                         buffer.slice(8, 12).toString('ascii') === 'mif1';
    
    let actualMimeType = file.type;
    if (isLikelyHEIC && !file.type.includes('heic') && !file.type.includes('heif')) {
      console.log("⚠️  [WIZARD UPLOAD] Detected HEIC by magic bytes, overriding MIME type");
      actualMimeType = 'image/heic';
    }

    // Process image through strict pipeline
    console.log("🔄 [WIZARD UPLOAD] Starting image processing");
    let processedImageSet;
    try {
      processedImageSet = await processImage(
        buffer,
        actualMimeType,
        DEFAULT_IMAGE_CONFIG
      );
      console.log("✅ [WIZARD UPLOAD] Image processed successfully");
    } catch (processingError: unknown) {
      const message = processingError instanceof Error ? processingError.message : "Image processing failed";
      console.error("❌ [WIZARD UPLOAD] Processing failed:", message);
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

    // Register in media library with TEMP status
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
      
      console.log("✅ [WIZARD UPLOAD] Registered as TEMP MediaAsset:", {
        mediaId,
        wizardSessionId,
        draftEntityId,
        draftEntityType,
      });
    } catch (mediaError) {
      console.error("❌ [WIZARD UPLOAD] Failed to register media:", mediaError);
      return NextResponse.json({ error: "Failed to register media" }, { status: 500 });
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
      status: "TEMP",
      wizardSessionId,
    });
  } catch (error: unknown) {
    console.error("❌ [WIZARD UPLOAD] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
