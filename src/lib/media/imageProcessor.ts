 
/**
 * Image Processing Service
 * 
 * Centralized image processing pipeline using sharp.
 * Handles format conversion, resizing, optimization, and HEIC/HEIF support.
 */

import sharp from "sharp";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  ALLOWED_UPLOAD_MIME_TYPE_SET,
  MAX_UPLOAD_SIZE_MB,
  normalizeUploadMimeType,
} from "@/lib/uploads/uploadConfig";

export interface ImageProcessingConfig {
  maxUploadSizeMB: number;
  maxMasterWidth: number;
  outputFormat: "webp";
  outputQuality: number;
  sizes: {
    xl: number;
    lg: number;
    md: number;
    sm: number;
  };
}

export const DEFAULT_IMAGE_CONFIG: ImageProcessingConfig = {
  maxUploadSizeMB: MAX_UPLOAD_SIZE_MB,
  maxMasterWidth: 1600,
  outputFormat: "webp",
  outputQuality: 80,
  sizes: {
    xl: 1600,
    lg: 1200,
    md: 800,
    sm: 400,
  },
};

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ProcessedImageSet {
  master: ProcessedImage;
  sizes: {
    xl?: ProcessedImage;
    lg?: ProcessedImage;
    md?: ProcessedImage;
    sm?: ProcessedImage;
  };
  originalMimeType: string;
  originalWidth: number;
  originalHeight: number;
}

/**
 * Validate image file
 */
export function validateImageFile(
  file: File | Buffer,
  mimeType: string,
  config: ImageProcessingConfig = DEFAULT_IMAGE_CONFIG
): { valid: boolean; error?: string } {
  const normalizedMimeType = normalizeUploadMimeType(mimeType);

  if (!normalizedMimeType || !ALLOWED_UPLOAD_MIME_TYPE_SET.has(normalizedMimeType)) {
    return {
      valid: false,
      error: `Unsupported image format: ${mimeType}. Allowed: ${ALLOWED_UPLOAD_MIME_TYPES.join(", ")}`,
    };
  }

  // Check file size
  const sizeBytes = file instanceof File ? file.size : file.length;
  const maxBytes = config.maxUploadSizeMB * 1024 * 1024;

  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `File too large: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB. Max: ${config.maxUploadSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Process single image to specific size
 */
async function processImageToSize(
  sharpInstance: sharp.Sharp,
  targetWidth: number,
  quality: number
): Promise<ProcessedImage> {
  const processed = await sharpInstance
    .clone()
    .resize(targetWidth, undefined, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: processed.data,
    width: processed.info.width,
    height: processed.info.height,
    format: processed.info.format,
    size: processed.info.size,
  };
}

/**
 * Process image through complete pipeline
 * 
 * Steps:
 * 1. Validate format and size
 * 2. Load with sharp
 * 3. Auto-orient based on EXIF
 * 4. Resize to master size if needed
 * 5. Convert to WebP
 * 6. Generate responsive sizes
 */
export async function processImage(
  buffer: Buffer,
  originalMimeType: string,
  config: ImageProcessingConfig = DEFAULT_IMAGE_CONFIG
): Promise<ProcessedImageSet> {
  console.log("🔍 [PROCESSOR] Starting processImage:", {
    mimeType: originalMimeType,
    bufferSize: buffer.length,
    config: {
      maxUploadSizeMB: config.maxUploadSizeMB,
      maxMasterWidth: config.maxMasterWidth,
      outputFormat: config.outputFormat,
    },
  });

  try {
    // Validate
    const validation = validateImageFile(buffer, originalMimeType, config);
    if (!validation.valid) {
      console.error("❌ [PROCESSOR] Validation failed:", validation.error);
      throw new Error(validation.error);
    }
    console.log("✅ [PROCESSOR] Validation passed");

    // Load image with sharp
    let sharpInstance: sharp.Sharp;
    
    try {
      console.log("📸 [PROCESSOR] Loading image with sharp...");
      sharpInstance = sharp(buffer);
      
      // Auto-orient based on EXIF
      sharpInstance = sharpInstance.rotate();
      
      // Get metadata
      console.log("📊 [PROCESSOR] Reading metadata...");
      const metadata = await sharpInstance.metadata();
      console.log("✅ [PROCESSOR] Metadata read:", {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        hasAlpha: metadata.hasAlpha,
      });
      
      if (!metadata.width || !metadata.height) {
        throw new Error("Unable to read image dimensions");
      }

      const originalWidth = metadata.width;
      const originalHeight = metadata.height;

      // Process master image (resize if needed, convert to WebP)
      console.log("🎨 [PROCESSOR] Processing master image...");
      const master = await processImageToSize(
        sharpInstance,
        config.maxMasterWidth,
        config.outputQuality
      );
      console.log("✅ [PROCESSOR] Master image processed:", {
        width: master.width,
        height: master.height,
        size: master.size,
        format: master.format,
      });

      // Generate responsive sizes
      console.log("📐 [PROCESSOR] Generating responsive sizes...");
      const sizes: ProcessedImageSet["sizes"] = {};

      // Only generate sizes smaller than master
      for (const [sizeName, targetWidth] of Object.entries(config.sizes)) {
        if (targetWidth < master.width) {
          console.log(`  → Generating ${sizeName} (${targetWidth}px)...`);
          sizes[sizeName as keyof typeof sizes] = await processImageToSize(
            sharpInstance,
            targetWidth,
            config.outputQuality
          );
        } else {
          console.log(`  ⊘ Skipping ${sizeName} (${targetWidth}px) - larger than master`);
        }
      }

      console.log("✅ [PROCESSOR] All sizes generated");

      return {
        master,
        sizes,
        originalMimeType,
        originalWidth,
        originalHeight,
      };
    } catch (sharpError: unknown) {
      const sharpMsg = sharpError instanceof Error ? sharpError.message : String(sharpError);
      const sharpStack = sharpError instanceof Error ? sharpError.stack : undefined;
      console.error("❌ [PROCESSOR] Sharp error:", {
        message: sharpMsg,
        stack: sharpStack,
        mimeType: originalMimeType,
      });
      
      // Handle HEIC/HEIF specific errors
      const normalizedMimeTypeForError = normalizeUploadMimeType(originalMimeType);
      if (normalizedMimeTypeForError === "image/heic" || normalizedMimeTypeForError === "image/heif") {
        if (sharpMsg.includes("unsupported") || 
            sharpMsg.includes("HEIC") ||
            sharpMsg.includes("HEIF")) {
          throw new Error(
            "HEIC/HEIF format is not supported in the current environment. " +
            "Please convert to JPEG, PNG, or WebP before uploading, or install libheif support on the server."
          );
        }
        
        if (sharpMsg.includes("bad seek") || 
            sharpMsg.includes("compression format")) {
          throw new Error(
            "Этот HEIC/HEIF файл использует неподдерживаемый формат сжатия. " +
            "Попробуйте конвертировать его в JPEG или PNG, или используйте другой HEIC файл."
          );
        }
        
        throw new Error(
          `Failed to process HEIC/HEIF file: ${sharpMsg}. ` +
          "Try converting to JPEG, PNG, or WebP before uploading."
        );
      }
      
      throw sharpError;
    }
  } catch (error: unknown) {
    console.error("❌ [PROCESSOR] Processing failed:", error instanceof Error ? error.message : String(error));
    throw new Error(`Image processing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get file extension for processed image
 */
export function getProcessedImageExtension(format: string): string {
  return format === "webp" ? "webp" : "jpg";
}

/**
 * Generate filename for processed image
 */
export function generateProcessedFilename(
  originalName: string,
  sizeSuffix?: string
): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const baseName = originalName.split(".")[0].replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const suffix = sizeSuffix ? `-${sizeSuffix}` : "";
  
  return `${timestamp}-${randomStr}-${baseName}${suffix}.webp`;
}
