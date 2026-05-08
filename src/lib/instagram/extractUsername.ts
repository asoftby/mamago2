/**
 * Extract Instagram username from various input formats
 *
 * Supported formats:
 * - @username
 * - username
 * - https://instagram.com/username
 * - https://www.instagram.com/username/
 * - instagram.com/username
 *
 * Returns null for invalid/unrecognized input.
 */

const RESERVED_PATHS = new Set(["p", "reel", "tv", "stories", "explore", "accounts", "direct", "ar", "about"]);
const USERNAME_RE = /^[a-zA-Z0-9._]{1,30}$/;

export function normalizeInstagramUsername(input: string): string | null {
  if (!input || typeof input !== "string") return null;

  let s = input.trim();
  if (!s) return null;

  // Strip leading @
  if (s.startsWith("@")) {
    s = s.slice(1).trim();
    if (!s) return null;
    return USERNAME_RE.test(s) ? s : null;
  }

  // Handle URLs — add protocol if missing so URL() can parse it
  if (s.includes("instagram.com")) {
    if (!s.startsWith("http://") && !s.startsWith("https://")) {
      s = "https://" + s;
    }
    try {
      const url = new URL(s);
      if (!url.hostname.includes("instagram.com")) return null;

      // Get first non-empty path segment
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return null;

      const candidate = parts[0];
      if (RESERVED_PATHS.has(candidate)) return null;
      return USERNAME_RE.test(candidate) ? candidate : null;
    } catch {
      return null;
    }
  }

  // Plain username
  return USERNAME_RE.test(s) ? s : null;
}

// Keep old export name as alias for backwards compat
export const extractInstagramUsername = normalizeInstagramUsername;

/** Canonical profile URL from stored place fields. */
export function resolveInstagramProfileHref(
  instagramUrl?: string | null,
  instagramHandle?: string | null,
): string | undefined {
  const url = instagramUrl?.trim();
  if (url) {
    if (/^https?:\/\//i.test(url)) return url;
    const u = normalizeInstagramUsername(url);
    if (u) return `https://www.instagram.com/${u}/`;
    return undefined;
  }
  const handle = instagramHandle?.trim();
  if (!handle) return undefined;
  const u = normalizeInstagramUsername(handle);
  return u ? `https://www.instagram.com/${u}/` : undefined;
}
