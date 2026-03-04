/**
 * Auth Cookie Configuration
 * Server-only helper for consistent cookie settings across subdomains
 */

export const SESSION_COOKIE_NAME = "mg_session";

/**
 * Get the cookie domain for auth session
 * 
 * Production: .mamago.by (shares across subdomains)
 * Development: undefined (localhost, host-only cookie)
 */
export function getAuthCookieDomain(): string | undefined {
  const isProd = process.env.NODE_ENV === "production";
  
  if (isProd) {
    // Production: .mamago.by for subdomain sharing
    return ".mamago.by";
  } else {
    // Development: undefined for localhost (no subdomain sharing needed)
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
