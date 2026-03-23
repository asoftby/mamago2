import type { BirthdayOffer, BirthdayOfferCategory } from "../types/birthday";

/** Slug интереса ребёнка → категории предложений с лёгким бустом релевантности */
const INTEREST_SLUG_CATEGORY_BOOST: Partial<Record<string, BirthdayOfferCategory[]>> = {
  sport: ["ANIMATOR", "MASTER_CLASS"],
  music: ["SHOW", "ANIMATOR"],
  art: ["DECOR", "MASTER_CLASS", "ANIMATOR"],
  dance: ["SHOW", "ANIMATOR"],
  animals: ["ANIMATOR", "SHOW"],
  books: ["ANIMATOR"],
  construction: ["MASTER_CLASS", "DECOR"],
  science: ["MASTER_CLASS"],
  nature: ["ANIMATOR", "MASTER_CLASS"],
  technology: ["MASTER_CLASS"],
  creativity: ["DECOR", "MASTER_CLASS"],
  "active-games": ["ANIMATOR", "MASTER_CLASS"],
  "quiet-activities": ["DECOR", "PHOTO", "CAKE"],
};

function interestBoostForOffer(offer: BirthdayOffer, slugs: string[] | undefined): number {
  if (!slugs?.length) return 0;
  let boost = 0;
  for (const slug of slugs) {
    const cats = INTEREST_SLUG_CATEGORY_BOOST[slug];
    if (cats?.includes(offer.category)) boost += 8;
  }
  return Math.min(boost, 24);
}

/** Score an offer for relevance. Higher = better. */
export function scoreBirthdayOffer(
  offer: BirthdayOffer,
  opts?: { interestSlugs?: string[] }
): number {
  let score = 0;
  if (offer.isFeatured) score += 30;
  if (offer.rating) score += offer.rating * 5;
  if (offer.reviewCount) score += Math.min(offer.reviewCount / 10, 15);
  score += interestBoostForOffer(offer, opts?.interestSlugs);
  return score;
}

export function rankBirthdayOffers(
  offers: BirthdayOffer[],
  opts?: { interestSlugs?: string[] }
): BirthdayOffer[] {
  return [...offers].sort(
    (a, b) => scoreBirthdayOffer(b, opts) - scoreBirthdayOffer(a, opts)
  );
}
