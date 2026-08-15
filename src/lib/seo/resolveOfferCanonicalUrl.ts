import { validateStoredCanonical } from "./validateStoredCanonical";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";

/**
 * Resolves the canonical URL for a publicly-visible Offer detail page.
 *
 * The canonical Offer route is city-scoped, section-free
 * (`/{city}/offers/{slug}`) — the old `/{city}/offers/{section}/{slug}`
 * and `/offers/{slug}` are both legacy paths that always 301-redirect
 * here. `{section}` was dropped from the canonical identity because it's
 * computed from `kind`/`durationType`/`campProgramType` (a mutable
 * taxonomy/filter concept, not a permanent identity) — see
 * `docs/migration/seo/final-url-architecture-2026-08-15.md` §3,
 * BACKLOG-116. A stored `seoCanonicalUrl` is only trusted if it matches
 * that exact expected path for the current city/slug and current public
 * origin; otherwise it falls back to the deterministic city-scoped path
 * so a stale or section-scoped stored value can never point at a page
 * that itself redirects.
 */
export interface ResolveOfferCanonicalUrlInput {
  seoCanonicalUrl: string | null | undefined;
  slug: string | null;
  citySlug: string;
  publicBase: string;
}

export function resolveOfferCanonicalUrl(input: ResolveOfferCanonicalUrlInput): string {
  const expectedPath = getOfferPublicPath({ slug: input.slug }, input.citySlug);
  const fallback = `${input.publicBase.replace(/\/$/, "")}${expectedPath}`;

  const validated = validateStoredCanonical({
    stored: input.seoCanonicalUrl,
    publicBase: input.publicBase,
    expectedPath,
  });

  return validated ?? fallback;
}
