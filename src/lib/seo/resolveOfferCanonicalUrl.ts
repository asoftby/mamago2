import { validateStoredCanonical } from "./validateStoredCanonical";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";

/**
 * Resolves the canonical URL for a publicly-visible Offer detail page.
 *
 * The canonical Offer route is city+section-scoped
 * (`/{city}/offers/{section}/{slug}`) — `/offers/{slug}` is a legacy path
 * that always 301-redirects there. A stored `seoCanonicalUrl` is only
 * trusted if it matches that exact expected path for the current
 * city/section/slug and current public origin; otherwise it falls back to
 * the deterministic city-scoped path so a stale or wrongly-scoped stored
 * value can never point at a page that itself redirects.
 */
export interface ResolveOfferCanonicalUrlInput {
  seoCanonicalUrl: string | null | undefined;
  offer: { kind: string; durationType?: string | null; campProgramType?: string | null; slug: string | null };
  citySlug: string;
  publicBase: string;
}

export function resolveOfferCanonicalUrl(input: ResolveOfferCanonicalUrlInput): string {
  const expectedPath = getOfferPublicPath(input.offer, input.citySlug);
  const fallback = `${input.publicBase.replace(/\/$/, "")}${expectedPath}`;

  const validated = validateStoredCanonical({
    stored: input.seoCanonicalUrl,
    publicBase: input.publicBase,
    expectedPath,
  });

  return validated ?? fallback;
}
