/**
 * Extract file extension from various sources
 * 
 * Tries to determine real file extension from:
 * 1. originalName
 * 2. mimeType
 * 3. storageKey/publicUrl
 * 
 * Never returns "blob" as a valid extension.
 */

const MIME_TO_EXTENSION: Record<string, string> = {
  // Images
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  
  // Videos
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
  "video/quicktime": "mov",
  
  // Documents
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "text/csv": "csv",
};

/**
 * Extract extension from filename
 */
function extractFromFilename(filename: string | null | undefined): string | null {
  if (!filename) return null;
  
  const parts = filename.split(".");
  if (parts.length < 2) return null;
  
  const ext = parts[parts.length - 1].toLowerCase();
  
  // Filter out technical garbage
  if (ext === "blob" || ext === "tmp" || ext === "temp") {
    return null;
  }
  
  return ext;
}

/**
 * Extract extension from MIME type
 */
function extractFromMimeType(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null;
  
  // Direct mapping
  if (MIME_TO_EXTENSION[mimeType]) {
    return MIME_TO_EXTENSION[mimeType];
  }
  
  // Generic types
  if (mimeType.startsWith("image/")) {
    const subtype = mimeType.split("/")[1];
    if (subtype && subtype !== "octet-stream") {
      return subtype;
    }
  }
  
  if (mimeType.startsWith("video/")) {
    const subtype = mimeType.split("/")[1];
    if (subtype && subtype !== "octet-stream") {
      return subtype;
    }
  }
  
  return null;
}

/**
 * Extract extension from URL
 */
function extractFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Remove query params and fragments
  const cleanUrl = url.split("?")[0].split("#")[0];
  
  // Get filename from path
  const filename = cleanUrl.split("/").pop();
  
  return extractFromFilename(filename);
}

/**
 * Main extraction function
 * Tries multiple sources in order of reliability
 */
export function extractExtension(media: {
  originalName?: string | null;
  mimeType?: string | null;
  extension?: string | null;
  storageKey?: string | null;
  publicUrl?: string | null;
  filename?: string | null;
}): string | null {
  // 1. Try originalName first (most reliable)
  const fromOriginal = extractFromFilename(media.originalName);
  if (fromOriginal) return fromOriginal;
  
  // 2. Try mimeType
  const fromMime = extractFromMimeType(media.mimeType);
  if (fromMime) return fromMime;
  
  // 3. Try existing extension field (but validate it)
  const fromExtension = media.extension?.toLowerCase();
  if (fromExtension && fromExtension !== "blob" && fromExtension !== "tmp") {
    return fromExtension;
  }
  
  // 4. Try filename
  const fromFilename = extractFromFilename(media.filename);
  if (fromFilename) return fromFilename;
  
  // 5. Try storageKey
  const fromStorage = extractFromUrl(media.storageKey);
  if (fromStorage) return fromStorage;
  
  // 6. Try publicUrl
  const fromPublic = extractFromUrl(media.publicUrl);
  if (fromPublic) return fromPublic;
  
  return null;
}
