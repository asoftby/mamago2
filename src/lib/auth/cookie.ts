/**
 * Auth Cookie Configuration
 * Server-only helper for consistent cookie settings across subdomains
 */

export const SESSION_COOKIE_NAME = "mg_session";

/**
 * Get the cookie domain for auth session
 *
 * Production: .mamago.by (shares across subdomains)
 * Development:
 * - mamago.local -> .mamago.local
 * - localhost / 127.0.0.1 -> no explicit domain, browser keeps host-only cookie
 */
export function getAuthCookieDomain(): string | undefined {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    // Production: .mamago.by for subdomain sharing
    return ".mamago.by";
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_PUBLIC_URL?.trim();

  if (!baseUrl) {
    return undefined;
  }

  try {
    const hostname = new URL(baseUrl).hostname;

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.length === 0
    ) {
      return undefined;
    }

    if (hostname === "mamago.local" || hostname.endsWith(".mamago.local")) {
      return ".mamago.local";
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get secure flag for cookies
 * Only use secure in production (HTTPS)
 */
export function isSecureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Get standard cookie options for auth session
 */
export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax" as const,
    path: "/",
    domain: getAuthCookieDomain(),
  };
}
