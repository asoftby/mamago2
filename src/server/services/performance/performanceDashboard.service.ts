import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  comparisonPercent,
  ratioPercent,
  resolvePerformanceWindow,
  type PerformancePeriod,
} from "@/lib/performance/performanceMetrics";
import { loadAllEntityTitles } from "@/server/services/analytics/analyticsQueryHelpers";

type EventAggregateRow = {
  dau: bigint;
  wau: bigint;
  mau: bigint;
  trackedVisitors: bigint;
  previousTrackedVisitors: bigint;
  returningUsers: bigint;
  views: bigint;
  previousViews: bigint;
  opens: bigint;
  saves: bigint;
  planAdds: bigint;
  ctaClicks: bigint;
};
type UserAggregateRow = { newAccounts: bigint; previousNewAccounts: bigint };
type SearchAggregateRow = {
  searches: bigint;
  previousSearches: bigint;
  uniqueTrackedSearchers: bigint;
  zeroSearches: bigint;
};
type TopContentRow = { entityType: string; entityId: string; count: bigint };

export type PerformanceDashboardData = Awaited<ReturnType<typeof getPerformanceDashboard>>;

export async function getPerformanceDashboard(period: PerformancePeriod, now = new Date()) {
  const window = resolvePerformanceWindow(period, now);
  const dayWindow = resolvePerformanceWindow("today", now);
  const weekWindow = resolvePerformanceWindow("7d", now);
  const monthWindow = resolvePerformanceWindow("30d", now);
  const eventScanStart = window.previousStart < monthWindow.start ? window.previousStart : monthWindow.start;
  const whereCurrent = { createdAt: { gte: window.start, lt: window.end } };

  const [
    eventRows, userRows, searchRows,
    publishedEvents, publishedPlaces, publishedOffers, activeBusinesses, createdRoutes,
    topRows,
  ] = await Promise.all([
    prisma.$queryRaw<EventAggregateRow[]>(Prisma.sql`
      SELECT
        COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= ${dayWindow.start} AND "createdAt" < ${dayWindow.end})::bigint AS dau,
        COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= ${weekWindow.start} AND "createdAt" < ${weekWindow.end})::bigint AS wau,
        COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= ${monthWindow.start} AND "createdAt" < ${monthWindow.end})::bigint AS mau,
        COUNT(DISTINCT "sessionId") FILTER (WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end})::bigint AS "trackedVisitors",
        COUNT(DISTINCT "sessionId") FILTER (WHERE "createdAt" >= ${window.previousStart} AND "createdAt" < ${window.previousEnd})::bigint AS "previousTrackedVisitors",
        COUNT(DISTINCT "userId") FILTER (
          WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end}
            AND EXISTS (
              SELECT 1 FROM "UserEvent" prior
              WHERE prior."userId" = "UserEvent"."userId" AND prior."createdAt" < ${window.start}
            )
        )::bigint AS "returningUsers",
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end} AND "eventType" = 'CARD_VIEW')::bigint AS views,
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.previousStart} AND "createdAt" < ${window.previousEnd} AND "eventType" = 'CARD_VIEW')::bigint AS "previousViews",
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end} AND "eventType" = 'DETAIL_OPEN')::bigint AS opens,
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end} AND "eventType" = 'SAVE')::bigint AS saves,
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end} AND "eventType" = 'PLAN_ADD')::bigint AS "planAdds",
        COUNT(*) FILTER (
          WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end}
            AND "eventType" = 'CTA_CLICK'
            AND COALESCE("meta"->>'articleEvent', '') NOT IN (
              'article_read_25',
              'article_read_50',
              'article_read_75',
              'article_complete',
              'next_article_loaded',
              'article_section_exhausted'
            )
        )::bigint AS "ctaClicks"
      FROM "UserEvent"
      WHERE "createdAt" >= ${eventScanStart} AND "createdAt" < ${now}
    `),
    prisma.$queryRaw<UserAggregateRow[]>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end})::bigint AS "newAccounts",
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.previousStart} AND "createdAt" < ${window.previousEnd})::bigint AS "previousNewAccounts"
      FROM "User"
      WHERE "deletedAt" IS NULL AND "createdAt" >= ${window.previousStart} AND "createdAt" < ${window.end}
    `),
    prisma.$queryRaw<SearchAggregateRow[]>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end})::bigint AS searches,
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.previousStart} AND "createdAt" < ${window.previousEnd})::bigint AS "previousSearches",
        COUNT(DISTINCT COALESCE("userId", "sessionId")) FILTER (WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end})::bigint AS "uniqueTrackedSearchers",
        COUNT(*) FILTER (WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end} AND "resultsCount" = 0)::bigint AS "zeroSearches"
      FROM "SearchQueryLog"
      WHERE "createdAt" >= ${window.previousStart} AND "createdAt" < ${window.end}
    `),
    prisma.activity.count({ where: { status: "PUBLISHED" } }),
    prisma.place.count({ where: { status: "PUBLISHED" } }),
    prisma.offer.count({ where: { status: "PUBLISHED" } }),
    prisma.business.count({ where: { operationalStatus: "ACTIVE" } }),
    prisma.route.count({ where: whereCurrent }),
    prisma.$queryRaw<TopContentRow[]>(Prisma.sql`
      SELECT "entityType"::text AS "entityType", "entityId", COUNT(*)::bigint AS count
      FROM "UserEvent"
      WHERE "createdAt" >= ${window.start} AND "createdAt" < ${window.end}
        AND "entityType" IS NOT NULL AND "entityId" IS NOT NULL
        AND "eventType" IN ('DETAIL_OPEN', 'SAVE', 'PLAN_ADD', 'CTA_CLICK')
        AND (
          "eventType" <> 'CTA_CLICK'
          OR COALESCE("meta"->>'articleEvent', '') NOT IN (
            'article_read_25',
            'article_read_50',
            'article_read_75',
            'article_complete',
            'next_article_loaded',
            'article_section_exhausted'
          )
        )
      GROUP BY "entityType", "entityId"
      ORDER BY count DESC
      LIMIT 5
    `),
  ]);

  const topRefs = topRows.map((row) => ({ entityType: row.entityType, entityId: row.entityId }));
  const titles = await loadAllEntityTitles(topRefs);
  const events = eventRows[0];
  const users = userRows[0];
  const search = searchRows[0];
  const number = (value: bigint | undefined) => Number(value ?? 0);
  const dau = number(events?.dau);
  const wau = number(events?.wau);
  const mau = number(events?.mau);
  const trackedVisitors = number(events?.trackedVisitors);
  const previousTrackedVisitors = number(events?.previousTrackedVisitors);
  const newAccounts = number(users?.newAccounts);
  const previousNewAccounts = number(users?.previousNewAccounts);
  const views = number(events?.views);
  const previousViews = number(events?.previousViews);
  const searches = number(search?.searches);
  const previousSearches = number(search?.previousSearches);
  const zeroSearches = number(search?.zeroSearches);

  return {
    period,
    range: { start: window.start.toISOString(), end: window.end.toISOString(), timeZone: "Europe/Minsk" },
    audience: {
      dau, wau, mau,
      stickiness: ratioPercent(wau, mau),
      trackedVisitors,
      trackedVisitorsTrend: comparisonPercent(trackedVisitors, previousTrackedVisitors),
      newAccounts,
      newAccountsTrend: comparisonPercent(newAccounts, previousNewAccounts),
      returningUsers: number(events?.returningUsers),
    },
    engagement: {
      // Legacy field name kept for UI compatibility; Contract v1 meaning = CARD_VIEW only.
      views,
      opens: number(events?.opens),
      saves: number(events?.saves),
      planAdds: number(events?.planAdds),
      ctaClicks: number(events?.ctaClicks),
      viewsTrend: comparisonPercent(views, previousViews),
    },
    discovery: {
      searches,
      searchesTrend: comparisonPercent(searches, previousSearches),
      uniqueTrackedSearchers: number(search?.uniqueTrackedSearchers),
      zeroSearches,
      zeroSearchRate: ratioPercent(zeroSearches, searches),
    },
    inventory: { publishedEvents, publishedPlaces, publishedOffers, activeBusinesses, createdRoutes },
    topContent: topRows.map((row) => ({
      entityType: row.entityType,
      entityId: row.entityId,
      title: titles.get(`${row.entityType}:${row.entityId}`) ?? `${row.entityType} · ${row.entityId.slice(0, 8)}…`,
      interactions: Number(row.count),
    })),
  };
}
