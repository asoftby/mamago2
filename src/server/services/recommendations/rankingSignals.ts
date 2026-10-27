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
