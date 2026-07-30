/**
 * Auth Cookie Configuration
 * Server-only helper for consistent cookie settings across subdomains
 */

import { isDevLocalHost } from "@/lib/routing/surface";

export const SESSION_COOKIE_NAME = "mg_session";

function readTrimmedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * `next start` always sets NODE_ENV=production, even on localhost/DEV builds,
 * so bare NODE_ENV can never be the production signal here (see .env.example:
 * "Use APP_ENV to distinguish staging/preview/prod explicitly; do not rely on
 * NODE_ENV alone"). Real production deploys explicitly set APP_ENV=production
 * alongside NODE_ENV=production (see docs/migration/prelaunch-checklist.md).
 */
function isProductionAppEnv(): boolean {
  const appEnv = readTrimmedEnv("APP_ENV")?.toLowerCase();
  return appEnv === "production" || appEnv === "prod";
}

/**
 * Get the cookie domain for auth session
 *
 * Production (APP_ENV=production/prod only): .mamago.by (shares across subdomains)
 * Development:
 * - mamago.local -> .mamago.local (subdomain sharing)
 * - localhost / 127.0.0.1 / LAN IPs -> no explicit domain (host-only cookies)
 *
 * @param requestHostname - Optional hostname from request headers (e.g., from request.headers.get("host"))
 *                          If provided, uses this for dev host detection instead of NEXT_PUBLIC_APP_URL
 */
export function getAuthCookieDomain(requestHostname?: string): string | undefined {
  // Explicit override always wins, in any environment.
  const explicitDomain = readTrimmedEnv("AUTH_COOKIE_DOMAIN");
  if (explicitDomain) {
    return explicitDomain;
  }

  if (isProductionAppEnv()) {
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
    const baseUrl = readTrimmedEnv("NEXT_PUBLIC_APP_URL") ?? readTrimmedEnv("APP_PUBLIC_URL");

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
 *
 * AUTH_COOKIE_SECURE explicitly overrides (e.g. to test HTTPS locally).
 * Otherwise: true only under APP_ENV=production/prod; false everywhere else
 * (bare NODE_ENV=production from `next start` does not imply HTTPS).
 */
export function isSecureCookie(): boolean {
  const explicitSecure = readTrimmedEnv("AUTH_COOKIE_SECURE")?.toLowerCase();
  if (explicitSecure !== undefined) {
    return explicitSecure === "true";
  }
  return isProductionAppEnv();
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
