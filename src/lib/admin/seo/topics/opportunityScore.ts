/**
 * Opportunity score for internal mamaGo search demand.
 * Deterministic, no AI. Weights documented inline.
 */

export type OpportunityTier = "high" | "medium" | "low";

export type OpportunityInput = {
  searchesCurrent: number;
  searchesPrevious: number;
  zeroResultShare: number; // 0..1
};

/**
 * Score 0–100.
 * - Volume (0–40): log-ish scale of current searches
 * - Trend (0–35): positive growth vs previous period
 * - Zero-result gap (0–25): share of searches with 0 results
 */
export function computeOpportunityScore(input: OpportunityInput): {
  score: number;
  tier: OpportunityTier;
  label: string;
} {
  const volume = Math.min(
    40,
    Math.round(Math.log10(Math.max(input.searchesCurrent, 1) + 1) * 22),
  );

  let trend = 0;
  if (input.searchesPrevious > 0) {
    const delta =
      (input.searchesCurrent - input.searchesPrevious) /
      input.searchesPrevious;
    trend = Math.max(0, Math.min(35, Math.round(delta * 35)));
  } else if (input.searchesCurrent > 0) {
    // New query: modest trend boost, not max (avoid false confidence)
    trend = 18;
  }

  const gap = Math.max(
    0,
    Math.min(25, Math.round(input.zeroResultShare * 25)),
  );

  const score = Math.max(0, Math.min(100, volume + trend + gap));
  const tier: OpportunityTier =
    score >= 65 ? "high" : score >= 35 ? "medium" : "low";
  const label =
    tier === "high"
      ? "Высокий потенциал"
      : tier === "medium"
        ? "Средний"
        : "Низкий";

  return { score, tier, label };
}

export type TrendDirection = "up" | "down" | "flat" | "new";

export function computeTrendDirection(
  current: number,
  previous: number,
): { direction: TrendDirection; label: string; deltaAbs: number } {
  const deltaAbs = current - previous;
  if (previous === 0 && current > 0) {
    return { direction: "new", label: "Новое", deltaAbs };
  }
  if (previous === 0 && current === 0) {
    return { direction: "flat", label: "0", deltaAbs: 0 };
  }
  const pct = Math.round((deltaAbs / previous) * 100);
  if (pct > 5) {
    return { direction: "up", label: `+${pct}%`, deltaAbs };
  }
  if (pct < -5) {
    return { direction: "down", label: `${pct}%`, deltaAbs };
  }
  return { direction: "flat", label: "0%", deltaAbs };
}
