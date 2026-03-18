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
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import { MediaSourceType } from "@prisma/client";
import {
  processImage,
  generateProcessedFilename,
  DEFAULT_IMAGE_CONFIG,
} from "@/lib/media/imageProcessor";

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
    } catch (processingError: any) {
      return NextResponse.json(
        { error: processingError.message },
        { status: 400 }
      );
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save master image
    const masterFilename = generateProcessedFilename(file.name);
    const masterPath = join(uploadDir, masterFilename);
    await writeFile(masterPath, processedImageSet.master.buffer);
    const masterUrl = `/uploads/${masterFilename}`;

    // Save responsive sizes
    const responsiveSizes: Record<string, string> = {};
    for (const [sizeName, sizeData] of Object.entries(processedImageSet.sizes)) {
      if (sizeData) {
        const sizeFilename = generateProcessedFilename(file.name, sizeName);
        const sizePath = join(uploadDir, sizeFilename);
        await writeFile(sizePath, sizeData.buffer);
        responsiveSizes[sizeName] = `/uploads/${sizeFilename}`;
      }
    }

    // Register in media library
    try {
      let sourceType: MediaSourceType = MediaSourceType.USER_UPLOAD;
      if (user.role === "ADMIN") {
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
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
