import type { RankedPartyCandidate } from "./partyCandidateRanking";

export type CandidateAvailability = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
export type CheckedPartyCandidate = RankedPartyCandidate & { availability: "AVAILABLE" | "UNKNOWN" };

/** Preserve rank order; known available candidates outrank unknown ones. */
export function selectCheckedPartyCandidates(
  checked: readonly { candidate: RankedPartyCandidate; availability: CandidateAvailability }[],
  limit = 5,
): CheckedPartyCandidate[] {
  const available: CheckedPartyCandidate[] = [];
  const unknown: CheckedPartyCandidate[] = [];
  for (const { candidate, availability } of checked) {
    if (availability === "AVAILABLE") available.push({ ...candidate, availability });
    if (availability === "UNKNOWN") unknown.push({ ...candidate, availability });
  }
  const seen = new Set<string>();
  const selected: CheckedPartyCandidate[] = [];
  for (const candidate of [...available, ...unknown]) {
    if (seen.has(candidate.businessId)) continue;
    seen.add(candidate.businessId);
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected;
}
