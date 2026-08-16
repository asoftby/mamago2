export type BrandingFaviconSource = {
  faviconUrl: string | null;
  faviconVersion?: string | null;
};

const FAVICON_ROUTE_HREF = "/favicon.ico";

/**
 * `/favicon.ico` always renders a PNG (branded asset or the bundled default,
 * see `(favicon)/favicon.ico/route.ts`) regardless of the source asset's own
 * format, so the `<link type>` value is constant rather than derived.
 */
export const BRANDING_FAVICON_MIME_TYPE = "image/png";

/**
 * `href` for the favicon `<link>` tags. Always points at the `/favicon.ico`
 * route — it serves a real icon even when no branding favicon is configured
 * (falls back to the bundled default) — cache-busted by `faviconVersion`
 * when a branding favicon is set.
 */
export function getBrandingFaviconRouteHref(source: BrandingFaviconSource): string {
  const version = source.faviconVersion?.trim();
  if (!version) return FAVICON_ROUTE_HREF;
  return `${FAVICON_ROUTE_HREF}?v=${encodeURIComponent(version)}`;
}
