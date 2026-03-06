/**
 * Image Compression Utilities
 * Client-side image processing: resize, compress, generate blurhash
 */

import imageCompression from "browser-image-compression";
import { encode } from "blurhash";

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
      useWebWorker: true,
      fileType,
      initialQuality: quality,
    });

    // Get image dimensions
    const dimensions = await getImageDimensions(compressedFile);

    // Generate blurhash
    const blurhash = await generateBlurhash(compressedFile);

    // Generate preview data URL
    const preview = await fileToDataURL(compressedFile);

    return {
      file: compressedFile,
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
  const { maxSizeMB = 10, allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"] } =
    options || {};

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}`,
    };
  }

  // Check file size
  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File too large. Max size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}
