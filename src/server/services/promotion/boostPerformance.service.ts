import { AnalyticsEntityType, UserEventType } from "@prisma/client";
import prisma from "@/lib/prisma";

export type PromotionPeriodMetrics = {
  /** Legacy field name kept for compatibility; Contract v1 meaning = CARD_VIEW impressions only. */
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
};

export type PromotionPeriodComparison = {
  /** Legacy field name kept for compatibility; compares CARD_VIEW impressions. */
  viewsMultiplier: number | null;
  planAddsPercentChange: number | null;
};

export type PromotionPeriod = {
  id: string;
  activityId: string;
  startAt: Date;
  endAt: Date;
  measuredUntil: Date;
  durationMs: number;
  elapsedMs: number;
  isActive: boolean;
  metrics: PromotionPeriodMetrics;
  baselineMetrics: PromotionPeriodMetrics;
  comparison: PromotionPeriodComparison;
};

export type ActivityPromotionPerformance = {
  periods: PromotionPeriod[];
  latestPeriod: PromotionPeriod | null;
  isPromoted: boolean;
};

const TRACKED_EVENT_TYPES: UserEventType[] = [
  UserEventType.CARD_VIEW,
  UserEventType.DETAIL_OPEN,
  UserEventType.SAVE,
  UserEventType.PLAN_ADD,
  UserEventType.CTA_CLICK,
];

function emptyMetrics(): PromotionPeriodMetrics {
  return { views: 0, opens: 0, saves: 0, planAdds: 0, ctaClicks: 0 };
}

async function getActivityMetricsForRange(params: {
  activityId: string;
  start: Date;
  end: Date;
}): Promise<PromotionPeriodMetrics> {
  if (params.end <= params.start) return emptyMetrics();

  const rows = await prisma.userEvent.groupBy({
    by: ["eventType"],
    where: {
      entityType: AnalyticsEntityType.EVENT,
      entityId: params.activityId,
      eventType: { in: TRACKED_EVENT_TYPES },
      createdAt: { gte: params.start, lt: params.end },
    },
    _count: { _all: true },
  });

  const metrics = emptyMetrics();
  for (const row of rows) {
    const count = row._count._all;
    if (row.eventType === UserEventType.CARD_VIEW) {
      metrics.views += count;
    } else if (row.eventType === UserEventType.DETAIL_OPEN) {
      metrics.opens += count;
    } else if (row.eventType === UserEventType.SAVE) {
      metrics.saves += count;
    } else if (row.eventType === UserEventType.PLAN_ADD) {
      metrics.planAdds += count;
    } else if (row.eventType === UserEventType.CTA_CLICK) {
      metrics.ctaClicks += count;
    }
  }

  return metrics;
}

function percentChange(value: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  return ((value - baseline) / baseline) * 100;
}

function multiplier(value: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  return value / baseline;
}

/**
 * Returns each persisted Boost as its own promotion period. Metrics are counted
 * from timestamped UserEvent rows, while the comparison window has the same
 * duration immediately preceding the period. This is a comparison, not causal
 * attribution.
 *
 * Contract v1 separates CARD_VIEW impressions from DETAIL_OPEN. PAGE_VIEW is
 * traffic telemetry and never contributes to publication Boost performance.
 */
export async function getPromotionPerformanceByActivityIds(
  activityIds: string[],
  now = new Date(),
): Promise<Map<string, ActivityPromotionPerformance>> {
  const uniqueActivityIds = [...new Set(activityIds)];
  if (uniqueActivityIds.length === 0) return new Map();

  const boosts = await prisma.boost.findMany({
    where: {
      activityId: { in: uniqueActivityIds },
      startAt: { lte: now },
    },
    select: {
      id: true,
      activityId: true,
      startAt: true,
      endAt: true,
    },
    orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
  });

  const periods = await Promise.all(
    boosts.flatMap((boost) => {
      if (!boost.activityId) return [];

      const measuredUntil = boost.endAt > now ? now : boost.endAt;
      const elapsedMs = Math.max(measuredUntil.getTime() - boost.startAt.getTime(), 0);
      const baselineStart = new Date(boost.startAt.getTime() - elapsedMs);
      const isActive = boost.startAt <= now && boost.endAt > now;

      return [
        Promise.all([
          getActivityMetricsForRange({
            activityId: boost.activityId,
            start: boost.startAt,
            end: measuredUntil,
          }),
          getActivityMetricsForRange({
            activityId: boost.activityId,
            start: baselineStart,
            end: boost.startAt,
          }),
        ]).then(([metrics, baselineMetrics]): PromotionPeriod => ({
          id: boost.id,
          activityId: boost.activityId!,
          startAt: boost.startAt,
          endAt: boost.endAt,
          measuredUntil,
          durationMs: Math.max(boost.endAt.getTime() - boost.startAt.getTime(), 0),
          elapsedMs,
          isActive,
          metrics,
          baselineMetrics,
          comparison: {
            viewsMultiplier: multiplier(metrics.views, baselineMetrics.views),
            planAddsPercentChange: percentChange(metrics.planAdds, baselineMetrics.planAdds),
          },
        })),
      ];
    }),
  );

  const result = new Map<string, ActivityPromotionPerformance>();
  for (const activityId of uniqueActivityIds) {
    const activityPeriods = periods.filter((period) => period.activityId === activityId);
    result.set(activityId, {
      periods: activityPeriods,
      latestPeriod: activityPeriods[0] ?? null,
      isPromoted: activityPeriods.some((period) => period.isActive),
    });
  }

  return result;
}
