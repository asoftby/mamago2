/**
 * retention.w1 / retention.w4 (+ `_n` cohort size, + `_prev` / `_prev_n`) —
 * every 24h.
 *
 * Weekly ISO cohorts (ТЗ «Аналитика админки», C4), Minsk weeks Mon-Sun:
 *
 *   W1: cohort = accounts registered in ISO week N; retained if they have
 *       >=1 qualifying planning action in week N+1.
 *   W4: same cohort definition; retained if active in week N+4.
 *
 * Only cohorts whose check week is already COMPLETE are measured, so the
 * newest W1 cohort is week (current - 2) and the newest W4 cohort is week
 * (current - 5); the check week is always the last completed week.
 * `_prev` is the same formula for the previous weekly cohort (N-1) — a
 * cohort-to-cohort comparison, not arbitrary date ranges.
 *
 * `*_n` is the cohort size. Small cohorts are noisy, so the dashboard hides
 * the percentage when n < MIN_RATE_SAMPLE (30) and shows n instead (see
 * dashboardViewModels.deriveHabit).
 *
 * An empty cohort (no signups that week) writes no samples for that cohort
 * — a retention rate is undefined for zero registrants, never a fabricated
 * 0/0 — mirroring search.ts's skip-when-undefined convention.
 *
 * "Qualifying planning action" is planningActivity.ts's single definition.
 */
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { addDateKeyDays, zonedDateKey } from "@/lib/stories/ranges";
import { AUDIENCE_EXCLUDED_ROLES } from "@/server/services/analytics/canonicalAudience";
import { isoWeekMondayKey, isoWeekRange } from "@/server/services/analytics/isoWeeks";
import { countUsersWithPlanningActivity } from "@/server/services/analytics/planningActivity";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

interface CohortResult {
  rate: number;
  size: number;
}

/**
 * Retention of the cohort registered in the ISO week starting `cohortMondayKey`,
 * measured in the week `weeksAfter` weeks later. null for an empty cohort.
 */
async function computeCohortRetention(
  ctx: MetricCollectorContext,
  cohortMondayKey: string,
  weeksAfter: number,
): Promise<CohortResult | null> {
  const { prisma } = ctx;
  const cohortWeek = isoWeekRange(cohortMondayKey, DEFAULT_TZ);

  const cohortUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: cohortWeek.start, lt: cohortWeek.end },
      role: { notIn: [...AUDIENCE_EXCLUDED_ROLES] },
    },
    select: { id: true },
  });
  if (cohortUsers.length === 0) return null;

  const checkWeek = isoWeekRange(addDateKeyDays(cohortMondayKey, 7 * weeksAfter), DEFAULT_TZ);
  const retained = await countUsersWithPlanningActivity(
    prisma,
    cohortUsers.map((u) => u.id),
    checkWeek.start,
    checkWeek.end,
  );
  return { rate: retained / cohortUsers.length, size: cohortUsers.length };
}

function pushCohort(samples: MetricSampleDraft[], metric: string, result: CohortResult | null): void {
  if (result === null) return;
  samples.push({ metric, value: result.rate }, { metric: `${metric}_n`, value: result.size });
}

export async function collectRetention(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const currentMonday = isoWeekMondayKey(zonedDateKey(ctx.now, DEFAULT_TZ));
  const weeksBack = (n: number) => addDateKeyDays(currentMonday, -7 * n);
  const samples: MetricSampleDraft[] = [];

  // Check week = the last completed week: cohort N = current - (weeksAfter + 1).
  pushCohort(samples, "retention.w1", await computeCohortRetention(ctx, weeksBack(2), 1));
  pushCohort(samples, "retention.w1_prev", await computeCohortRetention(ctx, weeksBack(3), 1));
  pushCohort(samples, "retention.w4", await computeCohortRetention(ctx, weeksBack(5), 4));
  pushCohort(samples, "retention.w4_prev", await computeCohortRetention(ctx, weeksBack(6), 4));

  return samples;
}

export const retentionCollector: MetricCollector = {
  name: "retention",
  intervalSec: 86_400,
  timeoutMs: 30_000,
  collect: collectRetention,
};
