/**
 * audience.wau / audience.mau — every 60 min (§21 Step 5, Phase C;
 * redefined by the canonical audience contract). Same canonical identity
 * as audienceDaily.ts (see `@/server/services/analytics/canonicalAudience`),
 * just the 7-day/30-day windows instead of the 1-day window — kept as a
 * separate collector because the frozen §8 interval for WAU/MAU (3600s)
 * differs from DAU's (900s); a MetricCollector has exactly one interval.
 *
 * `_prev` (added for the /admin dashboard rework's Growth block) is the
 * SAME identity over the immediately-preceding, equally-sized window
 * (`resolvePerformanceWindow`'s `previousStart`/`previousEnd`) — gives WoW
 * (WAU) / MoM (MAU) growth without any new MetricSample range-query
 * machinery.
 */
import { resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import { computeCanonicalAudience } from "@/server/services/analytics/canonicalAudience";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

export async function collectAudienceWeeklyMonthly(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const weekWindow = resolvePerformanceWindow("7d", ctx.now);
  const monthWindow = resolvePerformanceWindow("30d", ctx.now);

  const [wau, wauPrev, mau, mauPrev] = await Promise.all([
    computeCanonicalAudience(ctx.prisma, weekWindow.start, weekWindow.end),
    computeCanonicalAudience(ctx.prisma, weekWindow.previousStart, weekWindow.previousEnd),
    computeCanonicalAudience(ctx.prisma, monthWindow.start, monthWindow.end),
    computeCanonicalAudience(ctx.prisma, monthWindow.previousStart, monthWindow.previousEnd),
  ]);

  return [
    { metric: "audience.wau", value: wau.visitors },
    { metric: "audience.wau_prev", value: wauPrev.visitors },
    { metric: "audience.mau", value: mau.visitors },
    { metric: "audience.mau_prev", value: mauPrev.visitors },
  ];
}

export const audienceWeeklyMonthlyCollector: MetricCollector = {
  name: "audience_wau_mau",
  intervalSec: 3_600,
  timeoutMs: 20_000,
  collect: collectAudienceWeeklyMonthly,
};
