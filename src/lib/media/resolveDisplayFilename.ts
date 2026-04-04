/**
 * Resolve display filename for UI.
 *
 * Rule: the displayed extension must always match the actual mimeType.
 * If the file was converted (e.g. .jpg → webp), show the real extension.
 * Does NOT modify storageKey or publicUrl — display only.
 */

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg":    "jpg",
  "image/jpg":     "jpg",
  "image/png":     "png",
  "image/webp":    "webp",
  "image/avif":    "avif",
  "image/gif":     "gif",
  "image/svg+xml": "svg",
  "video/mp4":     "mp4",
  "video/webm":    "webm",
  "application/pdf": "pdf",
};

/** Strip any extension from a filename and return the basename. */
function basename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

export function resolveDisplayFilename(media: {
  filename: string;
  extension?: string | null;
  mimeType?: string | null;
}): string {
  // Determine the correct extension from mimeType (source of truth after conversion)
  const correctExt = media.mimeType ? MIME_TO_EXT[media.mimeType] : null;

  if (!correctExt) {
    // Unknown mime — fall back to stored filename as-is
    return media.filename;
  }

  // Always rebuild filename with the correct extension
  return `${basename(media.filename)}.${correctExt}`;
}
