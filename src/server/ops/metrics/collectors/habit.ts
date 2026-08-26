/**
 * habit.3of4week / habit.3of4week_prev — every 24h.
 *
 * Denominator is "activated planning families" (accounts whose FIRST-EVER
 * qualifying planning action predates the measured window), not "everyone
 * ever registered ≥28 days ago" — the latter would slowly turn this into a
 * graveyard-of-old-registrations metric as the all-time user base grows
 * relative to the currently-active one. See planningActivity.ts and the
 * dashboard plan for the full rationale.
 *
 * Habit rate = |eligible users active in >=3 of the trailing 4 weekly
 * buckets| / |eligible users|.
 *
 * `_prev` is the SAME 3-of-4 formula shifted by exactly 7 days (buckets
 * {1,2,3,4} instead of {0,1,2,3}), each against its own "eligible before
 * that window's start" denominator — answering "is habit improving week
 * over week", not a noisier 28-day-apart comparison.
 *
 * An empty eligible set skips writing that metric this cycle (undefined
 * rate, never a fabricated 0/0).
 */
import {
  getEligiblePlanningFamilies,
  getPlanningActiveUserWeekBuckets,
} from "@/server/services/analytics/planningActivity";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CURRENT_BUCKETS = [0, 1, 2, 3];
const PREV_BUCKETS = [1, 2, 3, 4];
const HABIT_THRESHOLD = 3;

function countHabitual(
  eligible: Set<string>,
  buckets: Map<string, Set<number>>,
  windowBuckets: readonly number[],
): number {
  let count = 0;
  for (const userId of eligible) {
    const userBuckets = buckets.get(userId);
    if (!userBuckets) continue;
    let activeWeeks = 0;
    for (const bucket of windowBuckets) {
      if (userBuckets.has(bucket)) activeWeeks += 1;
    }
    if (activeWeeks >= HABIT_THRESHOLD) count += 1;
  }
  return count;
}

export async function collectHabit(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const { prisma, now } = ctx;
  const buckets = await getPlanningActiveUserWeekBuckets(prisma, now, 5);

  const currentWindowStart = new Date(now.getTime() - CURRENT_BUCKETS.length * WEEK_MS);
  const prevWindowStart = new Date(now.getTime() - (PREV_BUCKETS[PREV_BUCKETS.length - 1]! + 1) * WEEK_MS);

  const [eligibleCurrent, eligiblePrev] = await Promise.all([
    getEligiblePlanningFamilies(prisma, currentWindowStart),
    getEligiblePlanningFamilies(prisma, prevWindowStart),
  ]);

  const samples: MetricSampleDraft[] = [];

  if (eligibleCurrent.size > 0) {
    samples.push({
      metric: "habit.3of4week",
      value: countHabitual(eligibleCurrent, buckets, CURRENT_BUCKETS) / eligibleCurrent.size,
    });
  }

  if (eligiblePrev.size > 0) {
    samples.push({
      metric: "habit.3of4week_prev",
      value: countHabitual(eligiblePrev, buckets, PREV_BUCKETS) / eligiblePrev.size,
    });
  }

  return samples;
}

export const habitCollector: MetricCollector = {
  name: "habit",
  intervalSec: 86_400,
  timeoutMs: 30_000,
  collect: collectHabit,
};
