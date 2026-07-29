import { validateStoredCanonical } from "./validateStoredCanonical";

/**
 * Resolves the canonical URL for a publicly-visible Place detail page.
 *
 * Prefers the stored `seoCanonicalUrl` (the same value `syncPlaceCanonical()`
 * writes via the real admin publish path) only if it is still valid — same
 * origin/path/slug, no query/hash — so a stale origin from a previous
 * `NEXT_PUBLIC_APP_URL` (e.g. `mamago.local:3000`) is rejected rather than
 * rendered verbatim. Otherwise falls back to the same slug-first path that
 * the builder itself computes, so a Place with no stored canonical yet still
 * gets a deterministic, correct one rather than none at all. Never falls
 * back to the internal DB id when a slug exists.
 */
export interface ResolvePlaceCanonicalUrlInput {
  seoCanonicalUrl: string | null | undefined;
  slug: string | null | undefined;
  id: string;
  publicBase: string;
}

export function resolvePlaceCanonicalUrl(input: ResolvePlaceCanonicalUrlInput): string {
  const slug = input.slug?.trim();
  const expectedPath = `/places/${slug || input.id}`;
  const fallback = `${input.publicBase.replace(/\/$/, "")}${expectedPath}`;

  const validated = validateStoredCanonical({
    stored: input.seoCanonicalUrl,
    publicBase: input.publicBase,
    expectedPath,
  });

  return validated ?? fallback;
}
