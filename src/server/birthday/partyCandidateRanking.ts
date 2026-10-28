import "server-only";
import { PartyCategory, type Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { offerPriceSnapshot } from "./partySelection";

export type PartyCandidateQuery = {
  citySlug: string;
  category: PartyCategory;
  childrenCount: number;
  childAge: number | null;
  budgetByn: number | null;
  excludedBusinessIds?: string[];
};

export type RankedPartyCandidate = {
  offerId: string;
  businessId: string;
  priceByn: number | null;
  score: number;
};

/** Pure, stable scoring: known affordable pricing is preferred, not required. */
export function scorePartyCandidate(price: number | null, budget: number | null): number {
  if (price === null) return 0;
  if (budget === null) return 1;
  return price <= budget ? 2 + (budget - price) / Math.max(1, budget) : -1;
}

/**
 * Search the full eligible set using keyset pages, never LIMIT 5 before ranking.
 * At most one offer per business is retained; the five highest ranked businesses
 * are returned, with deterministic tie breaks. This service sends NO invitations.
 * Availability will be evaluated in the subsequent integration slice.
 */
export async function rankPartyCandidates(input: PartyCandidateQuery): Promise<RankedPartyCandidate[]> {
  const city = await findCityBySlug(input.citySlug, { select: { id: true }, isActive: true });
  if (!city) return [];
  if (!Number.isInteger(input.childrenCount) || input.childrenCount < 1 ||
      (input.childAge !== null && (!Number.isInteger(input.childAge) || input.childAge < 0)) ||
      (input.budgetByn !== null && (!Number.isFinite(input.budgetByn) || input.budgetByn < 0))) return [];
  const excluded = new Set(input.excludedBusinessIds ?? []);
  const where: Prisma.OfferWhereInput = { AND: [
    getPublicPublishedOfferWhere(),
    { productType: "PARTY_SERVICE", category: input.category },
    { placements: { some: { key: "BIRTHDAY", status: "APPROVED" } } },
    { place: { cityId: city.id, ownerBusinessId: { not: null } } },
    { OR: [{ minChildren: null }, { minChildren: { lte: input.childrenCount } }] },
    { OR: [{ maxChildren: null }, { maxChildren: { gte: input.childrenCount } }] },
    ...(input.childAge === null ? [] : [
      { OR: [{ ageMinMonths: null }, { ageMinMonths: { lte: input.childAge * 12 + 11 } }] },
      { OR: [{ ageMaxMonths: null }, { ageMaxMonths: { gte: input.childAge * 12 } }] },
    ]),
  ] };
  const best = new Map<string, RankedPartyCandidate>();
  let cursor: string | undefined;
  while (true) {
    const page = await prisma.offer.findMany({
      where, take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true, priceFrom: true, priceMode: true, currency: true,
        place: { select: { ownerBusinessId: true } },
      },
    });
    if (!page.length) break;
    for (const offer of page) {
      const businessId = offer.place?.ownerBusinessId;
      if (!businessId || excluded.has(businessId)) continue;
      const price = offerPriceSnapshot(offer);
      if (input.budgetByn !== null && price !== null && price > input.budgetByn) continue;
      const candidate = { offerId: offer.id, businessId,
        priceByn: price, score: scorePartyCandidate(price, input.budgetByn) };
      const previous = best.get(businessId);
      if (!previous || candidate.score > previous.score ||
          (candidate.score === previous.score && candidate.offerId < previous.offerId))
        best.set(businessId, candidate);
    }
    cursor = page[page.length - 1].id;
    if (page.length < 200) break;
  }
  return [...best.values()].sort((a, b) => b.score - a.score ||
    a.businessId.localeCompare(b.businessId) || a.offerId.localeCompare(b.offerId)).slice(0, 5);
}
