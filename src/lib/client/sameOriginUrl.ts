/**
 * Rebase an internal app URL onto the current browser origin.
 *
 * The input may be either a relative app path or an absolute URL produced by
 * environment-aware helpers. For http(s) URLs we intentionally discard the
 * input origin and keep only pathname/search/hash, so editor navigation always
 * stays on the host where the user is currently working.
 */
export function sameOriginUrl(pathOrUrl: string): string {
  if (typeof window === "undefined") {
    return pathOrUrl;
  }

  try {
    const parsed = new URL(pathOrUrl, window.location.origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return pathOrUrl;
    }
    return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, window.location.origin).href;
  } catch {
    return pathOrUrl;
  }
}
