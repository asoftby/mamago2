export type BrandingFaviconSource = {
  faviconUrl: string | null;
  faviconMimeType?: string | null;
  faviconVersion?: string | null;
};

const FAVICON_ROUTE_HREF = "/favicon.ico";
const EMPTY_FAVICON_HREF = "data:,";

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function getPathExtension(url: string): string | null {
  const cleanUrl = url.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
  const dotIndex = cleanUrl.lastIndexOf(".");
  if (dotIndex === -1) return null;
  return cleanUrl.slice(dotIndex);
}

export function getBrandingFaviconHref(
  source: BrandingFaviconSource,
): string | null {
  const url = source.faviconUrl?.trim();
  if (!url) return null;

  const version = source.faviconVersion?.trim();
  if (!version) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

export function getBrandingFaviconRouteHref(
  source: BrandingFaviconSource,
): string {
  const url = source.faviconUrl?.trim();
  if (!url) return EMPTY_FAVICON_HREF;

  const version = source.faviconVersion?.trim();
  if (!version) return FAVICON_ROUTE_HREF;
  return `${FAVICON_ROUTE_HREF}?v=${encodeURIComponent(version)}`;
}

export function getBrandingFaviconMimeType(
  source: BrandingFaviconSource,
): string | undefined {
  const explicitMimeType = source.faviconMimeType?.trim();
  if (explicitMimeType) return explicitMimeType;

  const url = source.faviconUrl?.trim();
  if (!url) return undefined;

  const extension = getPathExtension(url);
  return extension ? MIME_TYPE_BY_EXTENSION[extension] : undefined;
}
