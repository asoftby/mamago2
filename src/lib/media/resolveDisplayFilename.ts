/**
 * Resolve display filename for UI
 * 
 * Fixes .blob extensions by using correct extension from metadata.
 * Does NOT modify storageKey or publicUrl - only for display.
 */

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

export function resolveDisplayFilename(media: {
  filename: string;
  extension?: string | null;
  mimeType?: string | null;
}): string {
  // Check if filename has wrong extension (.blob or .tmp)
  const hasWrongExtension = /\.(blob|tmp)$/.test(media.filename);
  
  if (!hasWrongExtension) {
    return media.filename;
  }

  // Try to get correct extension from metadata
  let correctExt = media.extension;
  
  // If extension is also wrong, try MIME type
  if (!correctExt || correctExt === "blob" || correctExt === "tmp") {
    correctExt = media.mimeType ? MIME_TO_EXT[media.mimeType] : null;
  }
  
  if (correctExt) {
    // Replace .blob/.tmp with correct extension
    return media.filename.replace(/\.(blob|tmp)$/, `.${correctExt}`);
  }

  // Return as-is if can't determine
  return media.filename;
}
