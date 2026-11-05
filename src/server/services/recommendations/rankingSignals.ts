import { SYSTEM_INTERESTS } from "@/lib/config/interests";

/**
 * Pure constants of the shared EVENT ranking contract (no DB imports), so surface layers can
 * normalise the shared ranker's signals without re-implementing them.
 * Owner: planSuggestions.service.ts (interest boost) and experienceAffinity.ts (history boost).
 */
export const INTEREST_MATCH_WEIGHT = 4;
export const MAX_INTEREST_MATCHES = 2;
/** Upper bound of the shared interest boost. */
export const MAX_INTEREST_BOOST = INTEREST_MATCH_WEIGHT * MAX_INTEREST_MATCHES;
export const EXPERIENCE_AFFINITY_MIN = -6;
export const EXPERIENCE_AFFINITY_MAX = 6;

/** Shared system-interest signal for events and offers; no surface-specific weights. */
export function profileInterestScoreFromSlugs(profile: readonly string[], candidate: readonly string[]) {
  const known = new Set(SYSTEM_INTERESTS.map(i => i.slug));
  const selected = new Set(profile.filter(s => known.has(s)));
  const interestMatchCount = Math.min(new Set(candidate.filter(s => selected.has(s))).size, MAX_INTEREST_MATCHES);
  return { interestMatchCount, interestBoost: interestMatchCount * INTEREST_MATCH_WEIGHT };
}
