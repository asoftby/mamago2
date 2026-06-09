/**
 * Helpers for the no-trailing-slash URL policy.
 *
 * These functions are extracted from middleware.ts so they can be unit-tested
 * without pulling in the full Next.js runtime.
 */

/** File extensions that must never receive a trailing-slash redirect. */
export const STATIC_EXT_RE =
  /\.(?:png|jpe?g|webp|gif|svg|ico|css|js|map|txt|xml|json|webmanifest|woff2?|ttf|eot|otf|pdf|zip|mp4|mp3|wav)$/i;

/**
 * Returns true when the pathname should be exempt from the trailing-slash
 * redirect.  We skip: root `/`, API routes, Next internals, Sentry tunnel,
 * and paths ending with a recognised static-asset extension.
 */
export function shouldSkipTrailingSlashRedirect(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/monitoring") ||
    STATIC_EXT_RE.test(pathname)
  );
}

/**
 * Given a pathname that ends with `/`, return the clean version without it.
 * The root `/` is returned as-is.
 */
export function removeTrailingSlash(pathname: string): string {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}
