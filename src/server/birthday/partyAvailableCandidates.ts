import "server-only";
import { loadConstructorCandidates } from "./constructorCandidates.service";
import { candidatePrice, candidateEvidence, type PartyCandidateQuery, type RankedPartyCandidate } from "./partyCandidateRanking";
export type AvailablePartyCandidate = RankedPartyCandidate & { availability: "AVAILABLE" | "PARTIAL" | "UNKNOWN" };
export type PartyAvailableCandidateQuery = PartyCandidateQuery & { date: string; timeFrom: string; timeTo: string; adultsCount: number };
/** Batch availability is already part of the same ranked candidate pass, never N previews per offer. */
export async function findAvailablePartyCandidates(input: PartyAvailableCandidateQuery): Promise<AvailablePartyCandidate[]> {
  const rows = await loadConstructorCandidates(input);
  const seen = new Set<string>();
  return rows.flatMap(row => {
    if (seen.has(row.offer.businessId) || row.offer.availability.state === "UNAVAILABLE") return [];
    seen.add(row.offer.businessId);
    return [{ offerId: row.offer.offerId, businessId: row.offer.businessId, priceByn: candidatePrice(row), score: row.interestBoost, evidence: candidateEvidence(row),
      availability: row.offer.availability.state }];
  }).slice(0,5);
}
