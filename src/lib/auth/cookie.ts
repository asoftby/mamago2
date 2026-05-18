/**
 * Auth Cookie Configuration
 * Server-only helper for consistent cookie settings across subdomains
 */

import { isDevLocalHost } from "@/lib/routing/surface";

export const SESSION_COOKIE_NAME = "mg_session";

/**
 * Get the cookie domain for auth session
 *
 * Production: .mamago.by (shares across subdomains)
 * Development:
 * - mamago.local -> .mamago.local (subdomain sharing)
 * - localhost / 127.0.0.1 / LAN IPs -> no explicit domain (host-only cookies)
 * 
 * @param requestHostname - Optional hostname from request headers (e.g., from request.headers.get("host"))
 *                          If provided, uses this for dev host detection instead of NEXT_PUBLIC_APP_URL
 */
export function getAuthCookieDomain(requestHostname?: string): string | undefined {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    // Production: .mamago.by for subdomain sharing
    return ".mamago.by";
  }

  // In development, prefer request hostname if provided
  let hostname: string | undefined;

  if (requestHostname) {
    // Extract hostname without port
    const parts = requestHostname.split(":");
    hostname = parts[0]?.toLowerCase();
  } else {
    // Fallback to NEXT_PUBLIC_APP_URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_PUBLIC_URL?.trim();

    if (!baseUrl) {
      return undefined;
    }

    try {
      hostname = new URL(baseUrl).hostname;
    } catch {
      return undefined;
    }
  }

  if (!hostname || hostname.length === 0) {
    return undefined;
  }

  // Check if this is a dev local host (localhost, 127.0.0.1, or LAN IP)
  if (isDevLocalHost(hostname)) {
    // Dev local hosts: no domain restriction, browser keeps host-only cookie
    if (process.env.NODE_ENV === "development") {
      console.debug(`[auth-cookie] Dev local host detected: ${hostname}, using host-only cookie`);
    }
    return undefined;
  }

  // mamago.local or *.mamago.local -> use .mamago.local for subdomain sharing
  if (hostname === "mamago.local" || hostname.endsWith(".mamago.local")) {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[auth-cookie] mamago.local detected: ${hostname}, using .mamago.local domain`);
    }
    return ".mamago.local";
  }

  // Unknown hostname in dev: use host-only cookie
  if (process.env.NODE_ENV === "development") {
    console.debug(`[auth-cookie] Unknown dev hostname: ${hostname}, using host-only cookie`);
  }
  return undefined;
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
 * 
 * @param requestHostname - Optional hostname from request headers for dev host detection
 */
export function getAuthCookieOptions(requestHostname?: string) {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax" as const,
    path: "/",
    domain: getAuthCookieDomain(requestHostname),
  };
}
