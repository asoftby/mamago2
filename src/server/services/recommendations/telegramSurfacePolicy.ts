import type { RankedPlanSuggestion } from "@/server/services/planSuggestions.service";

export const DEFAULT_TELEGRAM_RECOMMENDATION_POLICY = {
  resultCount: 5,
  horizonDays: 7,
  minimumScore: 0,
  minimumResultCount: 1,
  maxPerCategory: 2,
  repeatCooldownDays: 7,
} as const;

export type TelegramRecommendationPolicyConfig = {
  resultCount: number;
  horizonDays: number;
  minimumScore: number;
  minimumResultCount: number;
  maxPerCategory: number;
  repeatCooldownDays: number;
};

export type TelegramSurfacePolicyResult = {
  /** Composed candidates, even when no-send suppresses delivery. */
  selected: RankedPlanSuggestion[];
  noSendReason: "NO_CANDIDATES" | "MIN_RESULT_COUNT" | null;
  filtered: {
    belowMinimumScore: number;
    repeatCooldown: number;
    categoryDiversity: number;
  };
};

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, Math.round(finiteNumber(value, fallback))));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, finiteNumber(value, fallback)));
}

/**
 * Surface policy is deliberately limited to Telegram composition constraints.
 * It must not contain engagement/behavior weights; those remain owned by the
 * shared ranking pipeline.
 */
export function normalizeTelegramRecommendationPolicyConfig(
  value: unknown,
): TelegramRecommendationPolicyConfig {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const resultCount = clampInteger(
    input.resultCount,
    1,
    10,
    DEFAULT_TELEGRAM_RECOMMENDATION_POLICY.resultCount,
  );
  const minimumResultCount = clampInteger(
    input.minimumResultCount,
    0,
    resultCount,
    Math.min(DEFAULT_TELEGRAM_RECOMMENDATION_POLICY.minimumResultCount, resultCount),
  );

  return {
    resultCount,
    horizonDays: clampInteger(
      input.horizonDays,
      1,
      30,
      DEFAULT_TELEGRAM_RECOMMENDATION_POLICY.horizonDays,
    ),
    minimumScore: clampNumber(
      input.minimumScore,
      0,
      1_000_000,
      DEFAULT_TELEGRAM_RECOMMENDATION_POLICY.minimumScore,
    ),
    minimumResultCount,
    maxPerCategory: clampInteger(
      input.maxPerCategory,
      1,
      resultCount,
      Math.min(DEFAULT_TELEGRAM_RECOMMENDATION_POLICY.maxPerCategory, resultCount),
    ),
    repeatCooldownDays: clampInteger(
      input.repeatCooldownDays,
      0,
      90,
      DEFAULT_TELEGRAM_RECOMMENDATION_POLICY.repeatCooldownDays,
    ),
  };
}

/**
 * Applies Telegram-only composition after the shared ranked result.
 * The input order is preserved; this function never re-scores candidates.
 * `selected` remains observable when the minimum-result no-send gate trips;
 * delivery callers must require `noSendReason === null` before sending.
 */
export function applyTelegramSurfacePolicy(input: {
  ranked: RankedPlanSuggestion[];
  config: TelegramRecommendationPolicyConfig;
  cooldownEntityIds?: ReadonlySet<string>;
}): TelegramSurfacePolicyResult {
  const cooldownEntityIds = input.cooldownEntityIds ?? new Set<string>();
  const selected: RankedPlanSuggestion[] = [];
  const perCategory = new Map<string, number>();
  let belowMinimumScore = 0;
  let repeatCooldown = 0;
  let categoryDiversity = 0;

  for (const item of input.ranked) {
    if (item.score < input.config.minimumScore) {
      belowMinimumScore += 1;
      continue;
    }
    if (cooldownEntityIds.has(item.activity.id)) {
      repeatCooldown += 1;
      continue;
    }

    const categoryKey = item.activity.eventCategory?.id ?? `uncategorized:${item.activity.id}`;
    const currentCategoryCount = perCategory.get(categoryKey) ?? 0;
    if (currentCategoryCount >= input.config.maxPerCategory) {
      categoryDiversity += 1;
      continue;
    }

    selected.push(item);
    perCategory.set(categoryKey, currentCategoryCount + 1);
    if (selected.length >= input.config.resultCount) break;
  }

  const noSendReason =
    input.ranked.length === 0
      ? "NO_CANDIDATES"
      : selected.length < input.config.minimumResultCount
        ? "MIN_RESULT_COUNT"
        : null;

  return {
    selected,
    noSendReason,
    filtered: {
      belowMinimumScore,
      repeatCooldown,
      categoryDiversity,
    },
  };
}
