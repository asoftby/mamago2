/**
 * Resolves the canonical URL for a publicly-visible Place detail page.
 *
 * Prefers the stored `seoCanonicalUrl` (the same value `syncPlaceCanonical()`
 * writes via the real admin publish path); otherwise falls back to the same
 * slug-first path that builder itself computes, so a Place with no stored
 * canonical yet still gets a deterministic, correct one rather than none at
 * all. Never falls back to the internal DB id when a slug exists.
 */
export interface ResolvePlaceCanonicalUrlInput {
  seoCanonicalUrl: string | null | undefined;
  slug: string | null | undefined;
  id: string;
  publicBase: string;
}

export function resolvePlaceCanonicalUrl(input: ResolvePlaceCanonicalUrlInput): string {
  const stored = input.seoCanonicalUrl?.trim();
  if (stored) return stored;

  const slug = input.slug?.trim();
  return `${input.publicBase}/places/${slug || input.id}`;
}
