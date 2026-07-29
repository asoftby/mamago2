/**
 * Resolves the canonical URL for a publicly-visible Route detail page.
 *
 * Prefers the stored `seoCanonicalUrl` (the same value `syncRouteCanonical()`
 * writes via the real admin publish path); otherwise falls back to the same
 * slug-first path that builder itself computes, so a Route with no stored
 * canonical yet still gets a deterministic, correct one rather than none at
 * all. Never falls back to the internal DB id when a slug exists.
 *
 * Callers are responsible for only invoking this for a publicly-visible
 * Route (PUBLISHED + PUBLIC) — this function does not itself gate
 * visibility, matching the same contract as resolvePlaceCanonicalUrl.
 */
export interface ResolveRouteCanonicalUrlInput {
  seoCanonicalUrl: string | null | undefined;
  slug: string | null | undefined;
  id: string;
  publicBase: string;
}

export interface ResolvePublicRouteCanonicalUrlInput extends ResolveRouteCanonicalUrlInput {
  status: string;
  visibility: string;
}

export function resolveRouteCanonicalUrl(input: ResolveRouteCanonicalUrlInput): string {
  const slug = input.slug?.trim();
  const base = input.publicBase.replace(/\/$/, "");
  const fallback = `${base}/routes/${slug || input.id}`;
  const stored = input.seoCanonicalUrl?.trim();
  if (stored) {
    try {
      const url = new URL(stored);
      const publicOrigin = new URL(input.publicBase).origin;
      const expectedPath = `/routes/${slug || input.id}`;
      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.origin === publicOrigin &&
        url.pathname.replace(/\/$/, "") === expectedPath &&
        !url.search &&
        !url.hash
      ) {
        return url.toString();
      }
    } catch {
      // Invalid stored metadata must not prevent the deterministic fallback.
    }
  }

  return fallback;
}

export function resolvePublicRouteCanonicalUrl(
  input: ResolvePublicRouteCanonicalUrlInput,
): string | undefined {
  if (input.status !== "PUBLISHED" || input.visibility !== "PUBLIC") return undefined;
  return resolveRouteCanonicalUrl(input);
}
