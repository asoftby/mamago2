import { Prisma } from "@prisma/client";
import {
  eachDayOfInterval,
  endOfDay,
  min as minDate,
  startOfDay,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import type {
  AnalyticsOverviewFilters,
  AnalyticsOverviewResult,
} from "@/lib/analytics/adminOverviewTypes";
import {
  resolveAnalyticsDateRange,
  resolveCityIdFromSlug,
} from "@/server/services/analytics/analyticsDateRange";
import {
  analyticsEventWhereSql,
  applyAnalyticsUserFilter,
  buildAnalyticsBaseEventWhere,
  resolveAnalyticsAllowedUserIds,
} from "@/server/services/analytics/analyticsQueryHelpers";
import {
  canonicalMetricRowToCounts,
  canonicalMetricSelectSql,
  type CanonicalMetricRow,
} from "@/server/services/analytics/analyticsMetricSql";

async function getCanonicalMetrics(whereSql: Prisma.Sql): Promise<{
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
}> {
  const metricSelect = canonicalMetricSelectSql();
  const rows = await prisma.$queryRaw<CanonicalMetricRow[]>`
    SELECT ${metricSelect}
    FROM "UserEvent" e
    WHERE ${whereSql}
  `;
  const counts = canonicalMetricRowToCounts(rows[0]);
  return {
    views: counts.impressions,
    opens: counts.opens,
    saves: counts.saves,
    planAdds: counts.planAdds,
    ctaClicks: counts.ctaClicks,
  };
}

/**
 * Aggregated metrics for Analytics → Overview.
 * Contract v1: compatibility `views` means canonical content impressions;
 * PAGE_VIEW remains traffic-only and article transport events never inflate CTA.
 */
export async function getAnalyticsOverview(
  filters: AnalyticsOverviewFilters,
): Promise<AnalyticsOverviewResult> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const allowed = await resolveAnalyticsAllowedUserIds(filters);
  const baseUnfiltered = buildAnalyticsBaseEventWhere(start, end, filters, cityId);
  const base = applyAnalyticsUserFilter(baseUnfiltered, allowed);
  const wsql = analyticsEventWhereSql(start, end, filters, cityId, allowed);

  const [
    canonical,
    activeUserRows,
    sessionRows,
    profilesActiveInRange,
    topVerticalRows,
    topEntityRows,
  ] = await Promise.all([
    getCanonicalMetrics(wsql),
    prisma.userEvent.groupBy({
      by: ["userId"],
      where: { ...base, userId: { not: null } },
    }),
    prisma.userEvent.groupBy({
      by: ["sessionId"],
      where: { ...base, sessionId: { not: null } },
    }),
    allowed && allowed.size === 0
      ? Promise.resolve(0)
      : prisma.userBehaviorProfile.count({
          where: {
            lastSeenAt: { gte: start, lte: end },
            ...(allowed ? { userId: { in: [...allowed] } } : {}),
          },
        }),
    prisma.userEvent.groupBy({
      by: ["vertical"],
      where: { ...base, vertical: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { vertical: "desc" } },
      take: 5,
    }),
    prisma.userEvent.groupBy({
      by: ["entityType", "entityId"],
      where: {
        ...base,
        entityType: { not: null },
        entityId: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { entityId: "desc" } },
      take: 5,
    }),
  ]);

  const { views, opens, saves, planAdds, ctaClicks } = canonical;
  const activeUsers = activeUserRows.length;
  const sessions = sessionRows.length;

  // Contract v1 follows the publication interaction chain for ratios.
  // Null means the ratio is not measurable because its denominator is zero.
  const saveRate = opens > 0 ? saves / opens : null;
  const planRate = saves > 0 ? planAdds / saves : null;
  const clickRate = opens > 0 ? ctaClicks / opens : null;

  const top = Math.max(views, 1);
  const funnel = [
    {
      key: "view" as const,
      label: "Impressions",
      count: views,
      percentOfTop: 100,
    },
    {
      key: "open" as const,
      label: "Opens",
      count: opens,
      percentOfTop: Math.round((opens / top) * 1000) / 10,
    },
    {
      key: "save" as const,
      label: "Saves",
      count: saves,
      percentOfTop: Math.round((saves / top) * 1000) / 10,
    },
    {
      key: "plan" as const,
      label: "Plan",
      count: planAdds,
      percentOfTop: Math.round((planAdds / top) * 1000) / 10,
    },
    {
      key: "click" as const,
      label: "CTA",
      count: ctaClicks,
      percentOfTop: Math.round((ctaClicks / top) * 1000) / 10,
    },
  ];

  const topVerticals = topVerticalRows.map((r) => ({
    label: r.vertical ?? "—",
    count: r._count._all,
  }));

  const topEntities = topEntityRows.map((r) => ({
    label: `${r.entityType ?? "?"} · ${(r.entityId ?? "").slice(0, 8)}…`,
    sublabel: r.entityId ?? undefined,
    count: r._count._all,
  }));

  const rangeDays = eachDayOfInterval({
    start: startOfDay(start),
    end: startOfDay(end),
  });
  const cappedDays = rangeDays.slice(-90);
  const dailySeries: AnalyticsOverviewResult["dailySeries"] = [];

  const dayChunks = await Promise.all(
    cappedDays.map(async (d) => {
      const ds = startOfDay(d);
      const de = minDate([endOfDay(ds), end]);
      const daySql = analyticsEventWhereSql(ds, de, filters, cityId, allowed);
      const day = await getCanonicalMetrics(daySql);
      return {
        day: ds.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
        date: ds.toISOString().slice(0, 10),
        views: day.views,
        opens: day.opens,
      };
    }),
  );
  dailySeries.push(...dayChunks);

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    activeUsers,
    sessions,
    views,
    opens,
    saves,
    planAdds,
    ctaClicks,
    saveRate,
    planRate,
    clickRate,
    funnel,
    profilesActiveInRange,
    topVerticals,
    topEntities,
    dailySeries,
  };
}
