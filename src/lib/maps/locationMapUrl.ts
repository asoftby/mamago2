export interface LocationMapUrlResolution {
  mapImageUrl?: string;
  navigationUrl?: string;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Google Maps search/directions URLs are navigation pages, not image assets.
 * Passing one of these URLs into <img src> produces a permanently broken map.
 */
export function isGoogleMapsNavigationUrl(value: string): boolean {
  const url = parseHttpUrl(value.trim());
  if (!url) return false;

  const host = url.hostname.toLowerCase();
  if (host === "maps.google.com") return true;
  if (host === "www.google.com" || host === "google.com") {
    return url.pathname === "/maps" || url.pathname.startsWith("/maps/");
  }

  return false;
}

/**
 * Keeps the legacy `mapUrl` input safe while callers migrate to the explicit
 * `routeUrl` contract. Known Google Maps navigation URLs are promoted to the
 * route action; only non-navigation URLs are allowed to reach the image slot.
 */
export function resolveLocationMapUrl(mapUrl?: string | null): LocationMapUrlResolution {
  const value = mapUrl?.trim();
  if (!value) return {};

  if (isGoogleMapsNavigationUrl(value)) {
    return { navigationUrl: value };
  }

  return { mapImageUrl: value };
}
