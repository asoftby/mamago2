/**
 * Resolve display file type for UI
 * 
 * Converts technical metadata into user-friendly display type.
 * Never shows "blob" or other technical garbage.
 */

import { extractExtension } from "./extractExtension";

const MIME_TO_DISPLAY: Record<string, string> = {
  // Images
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/avif": "AVIF",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
  "image/bmp": "BMP",
  "image/tiff": "TIFF",
  
  // Videos
  "video/mp4": "MP4",
  "video/webm": "WEBM",
  "video/ogg": "OGG",
  "video/quicktime": "MOV",
  
  // Documents
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "text/plain": "TXT",
  "text/csv": "CSV",
};

/**
 * Resolve display file type
 */
export function resolveDisplayFileType(media: {
  mimeType?: string | null;
  extension?: string | null;
  originalName?: string | null;
  storageKey?: string | null;
  publicUrl?: string | null;
  filename?: string | null;
}): string {
  // 1. Try direct MIME type mapping
  if (media.mimeType && MIME_TO_DISPLAY[media.mimeType]) {
    return MIME_TO_DISPLAY[media.mimeType];
  }
  
  // 2. Try to extract extension
  const ext = extractExtension(media);
  if (ext) {
    return ext.toUpperCase();
  }
  
  // 3. Fallback to generic type based on MIME category
  if (media.mimeType) {
    if (media.mimeType.startsWith("image/")) {
      return "IMAGE";
    }
    if (media.mimeType.startsWith("video/")) {
      return "VIDEO";
    }
    if (media.mimeType.startsWith("audio/")) {
      return "AUDIO";
    }
    if (media.mimeType.startsWith("text/")) {
      return "TEXT";
    }
    if (media.mimeType.startsWith("application/")) {
      return "FILE";
    }
  }
  
  // 4. Last resort
  return "Unknown";
}

/**
 * Check if metadata is broken/incomplete
 */
export function isMetadataBroken(media: {
  extension?: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
}): boolean {
  // Extension is "blob" or missing
  const badExtension = !media.extension || media.extension === "blob" || media.extension === "tmp";
  
  // Size is 0 or missing
  const badSize = !media.sizeBytes || media.sizeBytes <= 0;
  
  // MIME type is generic or missing
  const badMime = !media.mimeType || 
    media.mimeType === "application/octet-stream" ||
    media.mimeType === "binary/octet-stream";
  
  return badExtension || badSize || badMime;
}
