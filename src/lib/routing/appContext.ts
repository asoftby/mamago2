/**
 * App context detection and URL building for account switcher.
 * 
 * Context is determined by hostname/subdomain, NOT by user role.
 * User roles only control access/visibility of menu items.
 */

import { ADMIN_PATH_PREFIX, BUSINESS_PATH_PREFIX } from "./surface";

export type AppContext = "personal" | "admin" | "business";

/**
 * Determines current app context from hostname.
 * 
 * Rules:
 * - admin.* → admin
 * - business.* → business  
 * - everything else → personal
 */
export function getCurrentAppContext(hostname?: string): AppContext {
  if (typeof window === "undefined" && !hostname) {
    return "personal";
  }

  const host = (hostname ?? window.location.hostname).toLowerCase();

  if (host.startsWith("admin.")) {
    return "admin";
  }

  if (host.startsWith("business.")) {
    return "business";
  }

  return "personal";
}

/**
 * Determines current app context from browser location.
 * Client-side only.
 */
export function getCurrentBrowserAppContext(): AppContext {
  if (typeof window === "undefined") {
    return "personal";
  }
  return getCurrentAppContext(window.location.hostname);
}

/**
 * Checks if current pathname indicates admin context (path-based routing fallback).
 */
export function isAdminPathname(pathname: string): boolean {
  return pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`);
}

/**
 * Checks if current pathname indicates business context (path-based routing fallback).
 */
export function isBusinessPathname(pathname: string): boolean {
  return pathname === BUSINESS_PATH_PREFIX || pathname.startsWith(`${BUSINESS_PATH_PREFIX}/`);
}

/**
 * Gets app context from hostname + pathname (with pathname fallback for compatibility).
 */
export function getAppContextFromHostAndPath(hostname: string, pathname: string): AppContext {
  // First check hostname (canonical)
  const contextFromHost = getCurrentAppContext(hostname);
  
  // If hostname indicates non-personal context, use it
  if (contextFromHost !== "personal") {
    return contextFromHost;
  }

  // Fallback: check pathname for path-based routing
  if (isAdminPathname(pathname)) {
    return "admin";
  }

  if (isBusinessPathname(pathname)) {
    return "business";
  }

  return "personal";
}

/**
 * Gets current app context from browser (hostname + pathname).
 * Client-side only.
 */
export function getCurrentBrowserAppContextWithPath(): AppContext {
  if (typeof window === "undefined") {
    return "personal";
  }
  return getAppContextFromHostAndPath(
    window.location.hostname,
    window.location.pathname,
  );
}
