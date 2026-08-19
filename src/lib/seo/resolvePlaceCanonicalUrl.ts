import { buildCityPublicPath } from "@/lib/routing/cityPaths";
import { validateStoredCanonical } from "./validateStoredCanonical";

/**
 * Resolves the canonical URL for a publicly-visible Place detail page —
 * `/{city}/places/{slug|id}`. `Place.slug` is only unique per-city
 * (`@@unique([cityId, slug])`), so the URL must include the city segment
 * to stay collision-safe across cities — see
 * `docs/migration/seo/final-url-architecture-2026-08-15.md` §2 for the
 * cross-city collision this replaces (the old `/places/{slug}` canonical
 * had no city segment despite per-city slug uniqueness).
 *
 * Prefers the stored `seoCanonicalUrl` (the same value `syncPlaceCanonical()`
 * writes via the real admin publish path) only if it is still valid — same
 * origin/path/city/slug, no query/hash — so a stale origin, or a canonical
 * carried over from before this city-scoping change, is rejected rather
 * than rendered verbatim. Otherwise falls back to the same slug-first path
 * the builder itself computes. Never falls back to the internal DB id when
 * a slug exists.
 */
export interface ResolvePlaceCanonicalUrlInput {
  seoCanonicalUrl: string | null | undefined;
  citySlug: string;
  slug: string | null | undefined;
  id: string;
  publicBase: string;
}

export function resolvePlaceCanonicalUrl(input: ResolvePlaceCanonicalUrlInput): string {
  const slug = input.slug?.trim() || input.id;
  const expectedPath = buildCityPublicPath({ citySlug: input.citySlug, type: "place", slug });
  const fallback = `${input.publicBase.replace(/\/$/, "")}${expectedPath}`;

  const validated = validateStoredCanonical({
    stored: input.seoCanonicalUrl,
    publicBase: input.publicBase,
    expectedPath,
  });

  return validated ?? fallback;
}
