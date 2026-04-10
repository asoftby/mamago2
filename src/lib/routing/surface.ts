/**
 * App surface routing — compatibility-first.
 *
 * Today, surfaces are determined by pathname prefixes (`/admin`, `/business`).
 * Host is accepted for future subdomain / tenant routing but does not change behavior yet.
 */

export type AppSurface = "public" | "admin" | "business";

/** Canonical path prefix for the admin UI (App Router). */
export const ADMIN_PATH_PREFIX = "/admin";

/** Canonical path prefix for the business UI (App Router). */
export const BUSINESS_PATH_PREFIX = "/business";

/**
 * Builds an absolute admin destination path under {@link ADMIN_PATH_PREFIX}.
 * Empty string yields `/admin/` (same behavior as the historical `adminPath` helper).
 */
export function buildAdminPath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${ADMIN_PATH_PREFIX}${cleanPath}`;
}

/** Historical name — use {@link buildAdminPath}; kept for drop-in compatibility. */
export const adminPath = buildAdminPath;

/**
 * Builds an absolute business destination path under {@link BUSINESS_PATH_PREFIX}.
 */
export function buildBusinessPath(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BUSINESS_PATH_PREFIX}${cleanPath}`;
}

/**
 * Normalizes a public (non-admin, non-business app shell) path.
 */
export function buildPublicPath(path: string): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Detects surface from pathname using current path-prefix rules.
 */
export function surfaceFromPathname(pathname: string): AppSurface {
  if (
    pathname === ADMIN_PATH_PREFIX ||
    pathname.startsWith(`${ADMIN_PATH_PREFIX}/`)
  ) {
    return "admin";
  }
  if (
    pathname === BUSINESS_PATH_PREFIX ||
    pathname.startsWith(`${BUSINESS_PATH_PREFIX}/`)
  ) {
    return "business";
  }
  return "public";
}

/**
 * Resolves surface from host + pathname. Host is reserved for future use; pathname wins today.
 */
export function resolveSurfaceFromHostAndPathname(
  _host: string | undefined,
  pathname: string,
): AppSurface {
  return surfaceFromPathname(pathname);
}
