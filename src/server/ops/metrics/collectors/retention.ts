/**
 * retention.w1 / retention.w1_prev, retention.w4 / retention.w4_prev —
 * every 24h.
 *
 * Registration-date cohort retention, deliberately NOT "any qualifying
 * action since signup" (that would be far too generous — see the Metric
 * Dictionary / dashboard plan for why this is named "W1/W4", not "D7/D30"):
 *
 *   W1: cohort = accounts registered on day D = today-7; retained if they
 *       have >=1 qualifying planning action in [D+2, D+7] — i.e. a single
 *       next-day-only return does NOT count as retained.
 *   W4: cohort = accounts registered on day D = today-30; retained if
 *       active in [D+22, D+30].
 *
 * `_prev` is the same formula for the cohort registered exactly one day
 * earlier (D-1), giving a same-shaped day-over-day comparison — "compare
 * cohorts, not arbitrary date ranges" per the product spec.
 *
 * An empty cohort (no signups on that calendar day) skips writing that
 * metric for this cycle entirely — a retention rate is undefined for zero
 * registrants, never a fabricated 0/0 — mirroring search.ts's
 * skip-when-undefined convention for zero_result_rate.
 */
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { addDateKeyDays, startOfZonedDay, zonedDateKey, zonedDayRange } from "@/lib/stories/ranges";
import { AUDIENCE_EXCLUDED_ROLES } from "@/server/services/analytics/canonicalAudience";
import { countUsersWithPlanningActivity } from "@/server/services/analytics/planningActivity";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

interface RetentionWindowSpec {
  /** Date key of the registration cohort day, e.g. "today - 7". */
  cohortDateKey: string;
  /** Offsets (inclusive) from the cohort day defining the check window. */
  checkStartOffsetDays: number;
  checkEndOffsetDaysExclusive: number;
}

async function computeRetentionRate(
  ctx: MetricCollectorContext,
  spec: RetentionWindowSpec,
): Promise<number | null> {
  const { prisma } = ctx;
  const cohortRange = zonedDayRange(spec.cohortDateKey, 1, DEFAULT_TZ);

  const cohortUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: cohortRange.start, lt: cohortRange.end },
      role: { notIn: [...AUDIENCE_EXCLUDED_ROLES] },
    },
    select: { id: true },
  });
  if (cohortUsers.length === 0) return null;

  const checkStart = startOfZonedDay(addDateKeyDays(spec.cohortDateKey, spec.checkStartOffsetDays), DEFAULT_TZ);
  const checkEnd = startOfZonedDay(addDateKeyDays(spec.cohortDateKey, spec.checkEndOffsetDaysExclusive), DEFAULT_TZ);

  const retained = await countUsersWithPlanningActivity(
    prisma,
    cohortUsers.map((u) => u.id),
    checkStart,
    checkEnd,
  );
  return retained / cohortUsers.length;
}

export async function collectRetention(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const todayKey = zonedDateKey(ctx.now, DEFAULT_TZ);
  const samples: MetricSampleDraft[] = [];

  const w1 = await computeRetentionRate(ctx, {
    cohortDateKey: addDateKeyDays(todayKey, -7),
    checkStartOffsetDays: 2,
    checkEndOffsetDaysExclusive: 8, // [D+2, D+7] inclusive of day D+7
  });
  if (w1 !== null) samples.push({ metric: "retention.w1", value: w1 });

  const w1Prev = await computeRetentionRate(ctx, {
    cohortDateKey: addDateKeyDays(todayKey, -8),
    checkStartOffsetDays: 2,
    checkEndOffsetDaysExclusive: 8,
  });
  if (w1Prev !== null) samples.push({ metric: "retention.w1_prev", value: w1Prev });

  const w4 = await computeRetentionRate(ctx, {
    cohortDateKey: addDateKeyDays(todayKey, -30),
    checkStartOffsetDays: 22,
    checkEndOffsetDaysExclusive: 31, // [D+22, D+30] inclusive of day D+30
  });
  if (w4 !== null) samples.push({ metric: "retention.w4", value: w4 });

  const w4Prev = await computeRetentionRate(ctx, {
    cohortDateKey: addDateKeyDays(todayKey, -31),
    checkStartOffsetDays: 22,
    checkEndOffsetDaysExclusive: 31,
  });
  if (w4Prev !== null) samples.push({ metric: "retention.w4_prev", value: w4Prev });

  return samples;
}

export const retentionCollector: MetricCollector = {
  name: "retention",
  intervalSec: 86_400,
  timeoutMs: 30_000,
  collect: collectRetention,
};
