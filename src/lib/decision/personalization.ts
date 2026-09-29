import type { Subject } from "@/lib/decision/decisionContext";

/**
 * A FIRST_PERSONALIZED_RESULT-class milestone requires an actually-applied
 * personalization input — a resolved profile subject or a canonical
 * explicit age-range filter — not merely a non-empty result from generic/
 * default ranking. An invalid or foreign personaId that resolved to
 * subjects=[] does not count either.
 */
export function isPersonalizedResult(subjects: Subject[], canonicalAgeRanges: string[]): boolean {
  return subjects.length > 0 || canonicalAgeRanges.length > 0;
}
