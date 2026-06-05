import { isAppMediaUrl } from "./isAppMediaUrl";

/** Gets the serving URL from a media record (publicUrl preferred). */
export function resolveMediaUrl(
  media:
    | { publicUrl?: string | null; storageKey?: string | null }
    | null
    | undefined,
): string | null {
  if (!media) return null;
  return media.publicUrl ?? null;
}

/**
 * Returns a transparent 1×1 GIF data-URI to use as a safe image placeholder.
 * Prevents broken-image icons without triggering layout shifts.
 */
export function getMediaPlaceholder(): string {
  return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
}

/**
 * Returns true if `url` looks like a loadable image source:
 * app-internal /api/media/… routes, absolute https URLs, or
 * other root-relative paths.
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const t = url.trim();
  if (!t) return false;
  if (isAppMediaUrl(t)) return true;
  if (t.startsWith("/") && !t.startsWith("/api/")) return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
