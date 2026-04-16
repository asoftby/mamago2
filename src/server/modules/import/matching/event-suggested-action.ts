/**
 * Event Suggested Action Determination
 *
 * Более консервативная политика чем для PLACE:
 * - Риск occurrence (same title + venue + different date) → всегда AMBIGUOUS
 * - Высокий порог для UPDATE_EXISTING
 * - Все случаи с кандидатами требуют human review
 */

import type { EventMatchCandidate } from "../types";

const THRESHOLDS = {
  /** Score выше этого → strong match (UPDATE_EXISTING) */
  STRONG_MATCH: 0.72,
  /** Score выше этого → possible match (MERGE) */
  POSSIBLE_MATCH: 0.40,
  /** Минимальный quality score для CREATE_NEW */
  MIN_QUALITY_FOR_CREATE: 0.20,
  /** Разница top-1 и top-2 — если меньше, AMBIGUOUS */
  AMBIGUITY_GAP: 0.15,
} as const;

export type EventSuggestedAction = "CREATE_NEW" | "UPDATE_EXISTING" | "MERGE" | "REJECT";
export type EventMatchStatus = "NO_MATCH" | "MATCHED" | "AMBIGUOUS" | "FAILED";

export interface EventSuggestedActionResult {
  matchStatus: EventMatchStatus;
  suggestedAction: EventSuggestedAction;
  confidenceScore: number;
  requiresReview: boolean;
  reviewPriority: number;
  reason: string;
}

export function determineEventSuggestedAction(
  candidates: EventMatchCandidate[],
  qualityScore: number,
): EventSuggestedActionResult {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0] ?? null;
  const second = sorted[1] ?? null;

  // ── Нет кандидатов ───────────────────────────────────────────────────────
  if (!top || top.score < THRESHOLDS.POSSIBLE_MATCH) {
    if (qualityScore < THRESHOLDS.MIN_QUALITY_FOR_CREATE) {
      return {
        matchStatus: "NO_MATCH",
        suggestedAction: "REJECT",
        confidenceScore: qualityScore,
        requiresReview: true,
        reviewPriority: 2,
        reason: `No match found, quality too low (${qualityScore.toFixed(2)}) to create`,
      };
    }
    return {
      matchStatus: "NO_MATCH",
      suggestedAction: "CREATE_NEW",
      confidenceScore: qualityScore,
      requiresReview: true,
      reviewPriority: 3,
      reason: `No existing Activity match found, quality sufficient (${qualityScore.toFixed(2)})`,
    };
  }

  // ── Occurrence risk — всегда AMBIGUOUS, независимо от score ──────────────
  if (top.signals.possibleOccurrenceRisk) {
    return {
      matchStatus: "AMBIGUOUS",
      suggestedAction: "MERGE",
      confidenceScore: top.score,
      requiresReview: true,
      reviewPriority: 9, // высокий приоритет — нужно разобраться
      reason: `Occurrence risk: similar title+venue but different date. ${top.entityTitle} (score=${top.score.toFixed(2)})`,
    };
  }

  // ── Сильное совпадение ───────────────────────────────────────────────────
  if (top.score >= THRESHOLDS.STRONG_MATCH) {
    const isAmbiguous =
      second != null &&
      second.score >= THRESHOLDS.POSSIBLE_MATCH &&
      top.score - second.score < THRESHOLDS.AMBIGUITY_GAP;

    if (isAmbiguous) {
      return {
        matchStatus: "AMBIGUOUS",
        suggestedAction: "MERGE",
        confidenceScore: top.score,
        requiresReview: true,
        reviewPriority: 8,
        reason: `Ambiguous: top=${top.score.toFixed(2)} (${top.entityTitle}), second=${second!.score.toFixed(2)} (${second!.entityTitle})`,
      };
    }

    return {
      matchStatus: "MATCHED",
      suggestedAction: "UPDATE_EXISTING",
      confidenceScore: top.score,
      requiresReview: true,
      reviewPriority: 7,
      reason: `Strong match: ${top.entityTitle} (score=${top.score.toFixed(2)}, ${top.reason})`,
    };
  }

  // ── Слабое/возможное совпадение ──────────────────────────────────────────
  return {
    matchStatus: "AMBIGUOUS",
    suggestedAction: "MERGE",
    confidenceScore: top.score,
    requiresReview: true,
    reviewPriority: 5,
    reason: `Possible match: ${top.entityTitle} (score=${top.score.toFixed(2)}), needs review`,
  };
}
