/**
 * SSRF Protection — Remote URL Safety Assertion
 *
 * Validates that a URL is safe to fetch from the server.
 * Only allows HTTPS connections to a whitelist of trusted hostnames.
 * Blocks private/reserved IP ranges, loopback, link-local, and raw IPs.
 */

// ─── Trusted hostname suffixes ────────────────────────────────────────────────
// Only hostnames ending with one of these suffixes are allowed.
const TRUSTED_HOSTNAME_SUFFIXES = [
  "fbcdn.net",
  "cdninstagram.com",
  "instagram.com",
];

// ─── Private / reserved IP checks ─────────────────────────────────────────────

function isPrivateOrReservedIP(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Named localhost variants
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;

  // metadata endpoints
  if (h === "metadata.google.internal") return true;

  // IPv4 raw address
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = h.match(ipv4);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // 127.0.0.0/8
    if (a === 127) return true;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (including 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8
    if (a === 0) return true;
    // 100.64.0.0/10 (CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // Any raw IP is rejected — we require a hostname matching the whitelist
    return true;
  }

  // IPv6
  if (h.includes(":")) {
    if (h === "::1") return true;
    if (h.startsWith("fe80:")) return true; // link-local
    if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique-local
    // Any raw IPv6 is rejected
    return true;
  }

  return false;
}

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
 * - No private/reserved IPs, no raw IP addresses
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

  // Block private/reserved IPs and raw IP addresses
  if (isPrivateOrReservedIP(url.hostname)) {
    throw new Error("Unsafe remote URL");
  }

  // Hostname must be in the trusted whitelist
  if (!isHostnameTrusted(url.hostname)) {
    throw new Error("Unsafe remote URL");
  }

  return url;
}