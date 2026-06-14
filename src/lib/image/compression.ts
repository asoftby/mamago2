/**
 * Image Compression Utilities
 * Client-side image processing: resize, compress, generate blurhash
 */

import imageCompression from "browser-image-compression";
import { encode } from "blurhash";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_MB,
  getFileTooLargeMessage,
  normalizeUploadMimeType,
  resolveUploadMimeType,
} from "@/lib/uploads/uploadConfig";

export interface CompressedImage {
  file: File;
  width: number;
  height: number;
  blurhash: string;
  preview: string; // data URL for preview
}

/**
 * Compress image to WebP/AVIF format
 * Max size: 2048px, quality: 0.8
 */
export async function compressImage(
  file: File,
  options?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    quality?: number;
    fileType?: string;
  }
): Promise<CompressedImage> {
  const {
    maxSizeMB = 1,
    maxWidthOrHeight = 2048,
    quality = 0.8,
    fileType = "image/webp",
  } = options || {};

  try {
    // Compress image
    const compressedFile = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      // true иногда зависает в Safari/Chrome (воркер не отвечает) — UI остаётся на «Загрузка…»
      useWebWorker: false,
      fileType,
      initialQuality: quality,
    });

    // Preserve original filename (browser-image-compression creates "blob" name)
    const finalFile = new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });

    // Get image dimensions
    const dimensions = await getImageDimensions(finalFile);

    // Generate blurhash
    const blurhash = await generateBlurhash(finalFile);

    // Generate preview data URL
    const preview = await fileToDataURL(finalFile);

    return {
      file: finalFile,
      width: dimensions.width,
      height: dimensions.height,
      blurhash,
      preview,
    };
  } catch (error) {
    console.error("Image compression error:", error);
    throw new Error("Failed to compress image");
  }
}

/**
 * Get image dimensions from file
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Generate blurhash from image file
 */
export async function generateBlurhash(
  file: File,
  componentX: number = 4,
  componentY: number = 3
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }

        // Scale down for blurhash (faster processing)
        const scale = Math.min(1, 100 / Math.max(img.width, img.height));
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);

        // Draw image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Generate blurhash
        const hash = encode(
          imageData.data,
          imageData.width,
          imageData.height,
          componentX,
          componentY
        );

        URL.revokeObjectURL(url);
        resolve(hash);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for blurhash"));
    };

    img.src = url;
  });
}

/**
 * Convert file to data URL
 */
export async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Generate tiny base64 placeholder (alternative to blurhash)
 */
export async function generateTinyPlaceholder(
  file: File,
  size: number = 20
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }

        // Create tiny thumbnail
        const aspectRatio = img.width / img.height;
        canvas.width = aspectRatio > 1 ? size : Math.floor(size * aspectRatio);
        canvas.height = aspectRatio > 1 ? Math.floor(size / aspectRatio) : size;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to base64
        const dataURL = canvas.toDataURL("image/jpeg", 0.5);

        URL.revokeObjectURL(url);
        resolve(dataURL);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for placeholder"));
    };

    img.src = url;
  });
}

/**
 * Validate image file
 */
export function validateImageFile(
  file: File,
  options?: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  }
): { valid: boolean; error?: string } {
  const { maxSizeMB = MAX_UPLOAD_SIZE_MB, allowedTypes = [...ALLOWED_UPLOAD_MIME_TYPES] } = options || {};
  const resolvedMimeType = resolveUploadMimeType(file);

  if (!resolvedMimeType) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}`,
    };
  }

  const normalizedAllowedTypes = allowedTypes
    .map((type) => normalizeUploadMimeType(type))
    .filter((type): type is string => Boolean(type));

  if (!normalizedAllowedTypes.includes(resolvedMimeType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}`,
    };
  }

  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: maxSizeMB === MAX_UPLOAD_SIZE_MB ? getFileTooLargeMessage() : `Файл слишком большой. Максимальный размер — ${maxSizeMB} МБ.`,
    };
  }

  return { valid: true };
}
