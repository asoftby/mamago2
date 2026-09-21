/**
 * SSRF Protection — Remote URL Safety Assertion
 *
 * Validates that a URL is safe to fetch from the server.
 * Only allows HTTPS connections to a whitelist of trusted hostnames.
 * This is a provider allowlist, not the network boundary. DNS/IP enforcement
 * and connection pinning are authoritative in `fetchBinary`.
 */

// ─── Trusted hostname suffixes ────────────────────────────────────────────────
// Only hostnames ending with one of these suffixes are allowed.
const TRUSTED_HOSTNAME_SUFFIXES = [
  "fbcdn.net",
  "cdninstagram.com",
  "instagram.com",
];

// ─── Hostname whitelist check ─────────────────────────────────────────────────

function isHostnameTrusted(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return TRUSTED_HOSTNAME_SUFFIXES.some(
    (suffix) => h === suffix || h.endsWith("." + suffix),
  );
}

// ─── Main assertion ───────────────────────────────────────────────────────────

/**
 * Parse and validate a remote URL for safe server-side fetching.
 *
 * Rules:
 * - Must be HTTPS only
 * - Hostname must match a trusted suffix (fbcdn.net, cdninstagram.com, instagram.com)
 * - DNS/IP safety is enforced by the shared pinned binary transport
 *
 * @throws {Error} "Unsafe remote URL" if the URL does not pass validation.
 * @returns The parsed URL object on success.
 */
export function assertSafeRemoteUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Unsafe remote URL");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Unsafe remote URL");
  }

  // Only HTTPS is allowed
  if (url.protocol !== "https:") {
    throw new Error("Unsafe remote URL");
  }

  if (url.username || url.password || !url.hostname) {
    throw new Error("Unsafe remote URL");
  }

  // Hostname must be in the trusted whitelist
  if (!isHostnameTrusted(url.hostname)) {
    throw new Error("Unsafe remote URL");
  }

  return url;
}
