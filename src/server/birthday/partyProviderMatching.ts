import type { PartyCategory, PartyLocationType } from "@prisma/client";

export type ProviderCandidate = {
  offerId: string;
  businessId: string;
  priceByn: number | null;
  availability: "AVAILABLE" | "UNKNOWN";
  category: PartyCategory;
};

export type ProviderOffer = {
  id: string;
  businessId: string;
  category: PartyCategory;
  locationType: PartyLocationType | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  minChildren: number | null;
  maxChildren: number | null;
  priceByn: number | null;
  availability: "AVAILABLE" | "UNKNOWN" | "UNAVAILABLE";
};

export function pickPartyProviders(params: {
  offers: ProviderOffer[];
  category: PartyCategory;
  venueMode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";
  childAgeYears: number | null;
  childrenCount: number;
  budgetByn: number | null;
  preferredOfferId?: string | null;
  excludeBusinessIds?: readonly string[];
  limit?: number;
}): ProviderCandidate[] {
  const { category, venueMode, childAgeYears, childrenCount, budgetByn } = params;
  const excluded = new Set(params.excludeBusinessIds ?? []);
  const isOffsite = venueMode === "HOME" || venueMode === "OUTDOOR";
  const ageMonths = childAgeYears === null ? null : childAgeYears * 12;
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 5);

  const matches = params.offers.filter(item => {
    if (item.category !== category || !item.businessId || excluded.has(item.businessId) ||
        item.availability === "UNAVAILABLE") return false;
    if (isOffsite && item.locationType !== "OFF_SITE" && item.locationType !== "BOTH") return false;
    if (ageMonths !== null && (
      (item.ageMinMonths !== null && ageMonths < item.ageMinMonths) ||
      (item.ageMaxMonths !== null && ageMonths > item.ageMaxMonths)
    )) return false;
    if ((item.minChildren !== null && childrenCount < item.minChildren) ||
        (item.maxChildren !== null && childrenCount > item.maxChildren)) return false;
    return true;
  });

  // Budget is a *soft* total-party preference, never a reason to hide all providers.
  const score = (offer: ProviderOffer) => {
    let result = offer.id === params.preferredOfferId ? 1000 : 0;
    result += offer.availability === "AVAILABLE" ? 100 : 0;
    result += budgetByn !== null && offer.priceByn !== null && offer.priceByn <= budgetByn ? 25 : 0;
    return result;
  };
  matches.sort((a, b) =>
    score(b) - score(a) ||
    (a.priceByn ?? Number.POSITIVE_INFINITY) - (b.priceByn ?? Number.POSITIVE_INFINITY) ||
    a.businessId.localeCompare(b.businessId) ||
    a.id.localeCompare(b.id));
  const chosen = new Set<string>();
  const result: ProviderCandidate[] = [];
  for (const offer of matches) {
    if (chosen.has(offer.businessId)) continue;
    chosen.add(offer.businessId);
    result.push({
      offerId: offer.id,
      businessId: offer.businessId,
      priceByn: offer.priceByn,
      // UNAVAILABLE candidates were filtered above; preserve narrow public type.
      availability: offer.availability === "AVAILABLE" ? "AVAILABLE" : "UNKNOWN",
      category: offer.category,
    });
    if (result.length >= limit) break;
  }
  return result;
}
