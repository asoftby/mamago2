/**
 * Absolute URL on the current browser origin for client-side fetch.
 * Ensures API calls hit the same host as the page (subdomains, custom dev hosts),
 * independent of the document base URL.
 */
export function sameOriginUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, window.location.origin).href;
}
