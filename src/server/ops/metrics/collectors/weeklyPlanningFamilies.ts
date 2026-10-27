/**
 * planning.wpf — Weekly Planning Families (North Star), every 60 min (same
 * cadence as audience_wau_mau).
 *
 * Counts distinct accounts with >=1 "meaningful planning action" in the
 * trailing 7 Minsk days — see planningActivity.ts for the exact qualifying-
 * action union and the ACCOUNT_AS_FAMILY_PROXY identity caveat (this is
 * mechanically Weekly Planning USERS; "Families" is the product name until
 * a real household entity exists).
 *
 * `planning.wpf` is the "right now" value (partial current day included).
 * Week-over-week growth uses `planning.wpf_completed` /
 * `planning.wpf_completed_prev`: the last 7 COMPLETED Minsk days vs the 7
 * before them (ТЗ «Аналитика админки», C1), so the percentage does not
 * depend on the weekday/hour of the sample.
 */
import { resolveCompletedWindow, resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import { countPlanningActiveUsers } from "@/server/services/analytics/planningActivity";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

export async function collectWeeklyPlanningFamilies(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const window = resolvePerformanceWindow("7d", ctx.now);
  const done = resolveCompletedWindow(7, ctx.now);

  const [current, completed, completedPrev] = await Promise.all([
    countPlanningActiveUsers(ctx.prisma, window.start, window.end),
    countPlanningActiveUsers(ctx.prisma, done.start, done.end),
    countPlanningActiveUsers(ctx.prisma, done.previousStart, done.previousEnd),
  ]);

  return [
    { metric: "planning.wpf", value: current },
    { metric: "planning.wpf_completed", value: completed },
    { metric: "planning.wpf_completed_prev", value: completedPrev },
  ];
}

export const weeklyPlanningFamiliesCollector: MetricCollector = {
  name: "weekly_planning_families",
  intervalSec: 3_600,
  timeoutMs: 30_000,
  collect: collectWeeklyPlanningFamilies,
};
