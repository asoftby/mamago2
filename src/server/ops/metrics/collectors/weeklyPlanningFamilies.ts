/**
 * planning.wpf / planning.wpf_prev — Weekly Planning Families (North Star),
 * every 60 min (same cadence as audience_wau_mau).
 *
 * Counts distinct accounts with >=1 "meaningful planning action" in the
 * trailing 7 days — see planningActivity.ts for the exact qualifying-action
 * union and the ACCOUNT_AS_FAMILY_PROXY identity caveat (this is
 * mechanically Weekly Planning USERS; "Families" is the product name until
 * a real household entity exists).
 *
 * `_prev` uses `resolvePerformanceWindow`'s `previousStart`/`previousEnd`
 * (the immediately-preceding, equally-sized 7-day window) so WoW growth can
 * be derived without any new MetricSample range-query machinery.
 */
import { resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import { countPlanningActiveUsers } from "@/server/services/analytics/planningActivity";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

export async function collectWeeklyPlanningFamilies(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const window = resolvePerformanceWindow("7d", ctx.now);

  const [current, previous] = await Promise.all([
    countPlanningActiveUsers(ctx.prisma, window.start, window.end),
    countPlanningActiveUsers(ctx.prisma, window.previousStart, window.previousEnd),
  ]);

  return [
    { metric: "planning.wpf", value: current },
    { metric: "planning.wpf_prev", value: previous },
  ];
}

export const weeklyPlanningFamiliesCollector: MetricCollector = {
  name: "weekly_planning_families",
  intervalSec: 3_600,
  timeoutMs: 20_000,
  collect: collectWeeklyPlanningFamilies,
};
