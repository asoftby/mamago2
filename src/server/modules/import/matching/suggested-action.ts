/**
 * Suggested Action Determination
 *
 * На основе match result и quality score определяет рекомендуемое действие.
 * Не выполняет publish/update — только recommendation для review.
 */

import type { PlaceMatchCandidate } from "../types";

/** Пороги для определения suggested action */
const THRESHOLDS = {
  /** Score выше этого → считаем strong match (UPDATE_EXISTING) */
  STRONG_MATCH: 0.65,
  /** Score выше этого → считаем возможным совпадением (MERGE) */
  POSSIBLE_MATCH: 0.35,
  /** Минимальный quality score для CREATE_NEW */
  MIN_QUALITY_FOR_CREATE: 0.20,
  /** Разница между top-1 и top-2 кандидатами — если меньше, то AMBIGUOUS */
  AMBIGUITY_GAP: 0.15,
} as const;

export type SuggestedAction = "CREATE_NEW" | "UPDATE_EXISTING" | "MERGE" | "REJECT";
export type MatchStatus = "NO_MATCH" | "MATCHED" | "AMBIGUOUS" | "FAILED";

export interface SuggestedActionResult {
  matchStatus: MatchStatus;
  suggestedAction: SuggestedAction;
  confidenceScore: number;
  /** Нужен ли human review */
  requiresReview: boolean;
  /** Приоритет review task (0–10, выше = важнее) */
  reviewPriority: number;
  reason: string;
}

export function determineSuggestedAction(
  candidates: PlaceMatchCandidate[],
  qualityScore: number,
): SuggestedActionResult {
  // Сортируем по score desc
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
      requiresReview: true, // всегда требует editorial review до publish
      reviewPriority: 3,
      reason: `No existing Place match found, quality sufficient (${qualityScore.toFixed(2)})`,
    };
  }

  // ── Сильное совпадение ───────────────────────────────────────────────────
  if (top.score >= THRESHOLDS.STRONG_MATCH) {
    // Проверяем ambiguity: если второй кандидат тоже сильный
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
      requiresReview: true, // всегда требует подтверждения перед update
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
