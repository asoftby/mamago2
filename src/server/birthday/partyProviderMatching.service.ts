import "server-only";
import { type PartyCategory, type Prisma } from "@prisma/client";
import { loadConstructorCandidates } from "./constructorCandidates.service";
import { candidatePrice, candidateEvidence } from "./partyCandidateRanking";
import type { PartySelectionContext } from "@/lib/birthday/constructorContract";

/** Compatibility entry point. Same candidate contract and assessment as order matching. */
export async function discoverPartyProviders(input: {
  citySlug: string; category: PartyCategory; venueMode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";
  date: Date; timeFrom: string; timeTo: string; childAgeYears: number | null;
  childrenCount: number; adultsCount: number; budgetByn: number | null;
  preferredOfferId?: string | null; excludeBusinessIds?: string[];
  performerRole?: "HOST" | "ANIMATOR"; selectionContext?: PartySelectionContext;
}, tx?: Prisma.TransactionClient) {
  const rows = await loadConstructorCandidates({ ...input, childAge: input.childAgeYears,
    date: input.date.toISOString().slice(0,10), excludedBusinessIds: input.excludeBusinessIds },tx);
  // Explicit selection preference is not paid promotion and cannot restore an incompatible offer.
  if (input.preferredOfferId) rows.sort((a,b) => Number(b.offer.offerId === input.preferredOfferId) - Number(a.offer.offerId === input.preferredOfferId));
  const seen = new Set<string>();
  return rows.flatMap(row => {
    if (seen.has(row.offer.businessId) || row.offer.availability.state === "UNAVAILABLE") return [];
    seen.add(row.offer.businessId);
    return [{ offerId: row.offer.offerId, businessId: row.offer.businessId, category: row.offer.category!, priceByn: candidatePrice(row), evidence: candidateEvidence(row), availability: row.offer.availability.state }];
  }).slice(0,5);
}
