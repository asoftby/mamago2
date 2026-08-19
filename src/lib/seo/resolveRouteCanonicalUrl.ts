import { validateStoredCanonical } from "./validateStoredCanonical";

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
  const expectedPath = `/routes/${slug || input.id}`;
  const fallback = `${base}${expectedPath}`;

  const validated = validateStoredCanonical({
    stored: input.seoCanonicalUrl,
    publicBase: input.publicBase,
    expectedPath,
  });

  return validated ?? fallback;
}

export function resolvePublicRouteCanonicalUrl(
  input: ResolvePublicRouteCanonicalUrlInput,
): string | undefined {
  if (input.status !== "PUBLISHED" || input.visibility !== "PUBLIC") return undefined;
  return resolveRouteCanonicalUrl(input);
}
