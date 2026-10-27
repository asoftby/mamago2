/**
 * audience.wau / audience.mau — every 60 min (§21 Step 5, Phase C;
 * redefined by the canonical audience contract). Same canonical identity
 * as audienceDaily.ts (see `@/server/services/analytics/canonicalAudience`),
 * just the 7-day/30-day windows instead of the 1-day window — kept as a
 * separate collector because the frozen §8 interval for WAU/MAU (3600s)
 * differs from DAU's (900s); a MetricCollector has exactly one interval.
 *
 * `audience.wau` / `audience.mau` are the "right now" values (trailing N
 * Minsk days including the partial current day) and stay the big numbers.
 *
 * Growth (WoW / MoM) is NOT derived from them (ТЗ «Аналитика админки», C1):
 * a window that ends "now" holds a partial day, so comparing it with a full
 * previous window under-reports growth early in the week. Growth uses the
 * `*_completed` / `*_completed_prev` pairs — the last N COMPLETED Minsk days
 * vs the N days before them (`resolveCompletedWindow`), which do not depend
 * on the hour or weekday the sample was taken.
 */
import { resolveCompletedWindow, resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import { computeCanonicalAudience } from "@/server/services/analytics/canonicalAudience";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

export async function collectAudienceWeeklyMonthly(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const weekWindow = resolvePerformanceWindow("7d", ctx.now);
  const monthWindow = resolvePerformanceWindow("30d", ctx.now);
  const weekDone = resolveCompletedWindow(7, ctx.now);
  const monthDone = resolveCompletedWindow(30, ctx.now);

  const [wau, wauDone, wauDonePrev, mau, mauDone, mauDonePrev] = await Promise.all([
    computeCanonicalAudience(ctx.prisma, weekWindow.start, weekWindow.end),
    computeCanonicalAudience(ctx.prisma, weekDone.start, weekDone.end),
    computeCanonicalAudience(ctx.prisma, weekDone.previousStart, weekDone.previousEnd),
    computeCanonicalAudience(ctx.prisma, monthWindow.start, monthWindow.end),
    computeCanonicalAudience(ctx.prisma, monthDone.start, monthDone.end),
    computeCanonicalAudience(ctx.prisma, monthDone.previousStart, monthDone.previousEnd),
  ]);

  return [
    { metric: "audience.wau", value: wau.visitors },
    { metric: "audience.wau_completed", value: wauDone.visitors },
    { metric: "audience.wau_completed_prev", value: wauDonePrev.visitors },
    { metric: "audience.mau", value: mau.visitors },
    { metric: "audience.mau_completed", value: mauDone.visitors },
    { metric: "audience.mau_completed_prev", value: mauDonePrev.visitors },
  ];
}

export const audienceWeeklyMonthlyCollector: MetricCollector = {
  name: "audience_wau_mau",
  intervalSec: 3_600,
  timeoutMs: 30_000,
  collect: collectAudienceWeeklyMonthly,
};
