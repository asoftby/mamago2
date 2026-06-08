/**
 * Client-safe media URL helpers.
 *
 * Must not import fs, path, server-only, Prisma, or any server modules.
 * Used by shared lib code that may be imported from Client Components.
 */

export const MEDIA_FILE_ROUTE_PREFIX = "/api/media/file";

export function buildMediaFilePublicUrl(relativePath: string): string {
  const normalized = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/u, "")
    .split("/")
    .filter(Boolean)
    .join("/");

  const encodedPath = normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${MEDIA_FILE_ROUTE_PREFIX}/${encodedPath}`;
}

/**
 * Extract relative storage path from `/api/media/file/...` or absolute URL
 * containing that segment.
 */
export function extractMediaRelativePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const marker = `${MEDIA_FILE_ROUTE_PREFIX}/`;
  const idx = trimmed.indexOf(marker);
  if (idx === -1) {
    return null;
  }

  let encoded = trimmed.slice(idx + marker.length);
  if (!encoded) return null;
  encoded = encoded.split(/[?#]/)[0] ?? "";
  if (!encoded) return null;

  const decoded = encoded
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("/");

  return decoded || null;
}
