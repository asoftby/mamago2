import type { AssessedConstructorOffer } from "./constructorMatching";
import "server-only";
import { loadConstructorCandidates, type ConstructorCandidateQuery } from "./constructorCandidates.service";
export type PartyCandidateQuery = ConstructorCandidateQuery & { includeAllRanked?: boolean };
export type RankedPartyCandidate = {
  offerId: string; businessId: string; priceByn: number | null; score: number;
  evidence?: ReturnType<typeof candidateEvidence>;

};
/** Legacy numeric helper retained for callers; the shared path keeps budgets soft. */
export function scorePartyCandidate(price: number | null, budget: number | null): number {
  if (price === null) return 0;
  if (budget === null) return 1;
  return price <= budget ? 2 + (budget - price) / Math.max(1,budget) : -1;
}
export function candidatePrice(row: Awaited<ReturnType<typeof loadConstructorCandidates>>[number]): number | null {
  const p = row.offer.price;
  return p.state !== "RESOLVED" || p.price.kind === "ON_REQUEST" ? null : Number(p.price.kind === "EXACT" ? p.price.amountByn : p.price.minimumByn);
}
/** Additive public evidence: no family interests, billing balance, allocation or resource IDs. */
export function candidateEvidence(row: AssessedConstructorOffer) {
  const offer=row.offer;
  return { price: offer.price.state === "RESOLVED" ? offer.price.price : { kind: "UNRESOLVED" as const, reason: offer.price.reason },
    assessments: row.assessments, durationMinutes: offer.durationMinutes.state === "KNOWN" ? offer.durationMinutes.value : null,
    performerRole: offer.performerRole?.state === "KNOWN" ? offer.performerRole.value : null };
}
export async function rankPartyCandidates(input: PartyCandidateQuery): Promise<RankedPartyCandidate[]> {
  const rows = await loadConstructorCandidates(input);
  const seen = new Set<string>();
  const ranked = rows.flatMap(row => {
    if (!input.includeAllRanked && seen.has(row.offer.businessId)) return [];
    seen.add(row.offer.businessId);
    return [{ offerId: row.offer.offerId, businessId: row.offer.businessId, priceByn: candidatePrice(row), score: row.interestBoost, evidence: candidateEvidence(row) }];
  });
  return input.includeAllRanked ? ranked : ranked.slice(0,5);
}
