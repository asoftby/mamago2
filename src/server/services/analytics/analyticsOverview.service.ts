import {
  Prisma,
  type AnalyticsEntityType,
  type AnalyticsVertical,
} from "@prisma/client";
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
  resolveAnalyticsAllowedUserIds,
} from "@/server/services/analytics/analyticsQueryHelpers";

function buildBaseWhere(
  start: Date,
  end: Date,
  filters: AnalyticsOverviewFilters,
  cityId: string | null,
): Prisma.UserEventWhereInput {
  const where: Prisma.UserEventWhereInput = {
    createdAt: { gte: start, lte: end },
  };

  if (filters.entity && filters.entity !== "all") {
    const map: Record<string, AnalyticsEntityType> = {
      event: "EVENT",
      place: "PLACE",
      offer: "OFFER",
      route: "ROUTE",
      article: "ARTICLE",
    };
    const et = map[filters.entity];
    if (et) where.entityType = et;
  }

  if (filters.vertical && filters.vertical !== "all") {
    const vmap: Record<string, AnalyticsVertical> = {
      city: "CITY",
      travel: "TRAVEL",
      birthday: "BIRTHDAY",
      education: "EDUCATION",
      weekend: "WEEKEND",
      seasonal: "SEASONAL",
    };
    const v = vmap[filters.vertical];
    if (v) where.vertical = v;
  }

  if (cityId) where.cityId = cityId;

  return where;
}

type CanonicalMetricRow = {
  views: bigint;
  opens: bigint;
  saves: bigint;
  plan_adds: bigint;
  cta_clicks: bigint;
};

async function getCanonicalMetrics(whereSql: Prisma.Sql): Promise<{
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
}> {
  const rows = await prisma.$queryRaw<CanonicalMetricRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (
        WHERE e."eventType" = 'CARD_VIEW'
          AND COALESCE(e."meta"->>'articleEvent', '') <> 'article_telegram_cta_impression'
      )::bigint AS views,
      COUNT(*) FILTER (WHERE e."eventType" = 'DETAIL_OPEN')::bigint AS opens,
      COUNT(*) FILTER (WHERE e."eventType" = 'SAVE')::bigint AS saves,
      COUNT(*) FILTER (WHERE e."eventType" = 'PLAN_ADD')::bigint AS plan_adds,
      COUNT(*) FILTER (
        WHERE e."eventType" = 'CTA_CLICK'
          AND COALESCE(e."meta"->>'articleEvent', '') NOT IN (
            'article_read_25',
            'article_read_50',
            'article_read_75',
            'article_complete',
            'next_article_loaded',
            'article_section_exhausted',
            'article_rating_submitted'
          )
      )::bigint AS cta_clicks
    FROM "UserEvent" e
    WHERE ${whereSql}
  `);
  const row = rows[0];
  return {
    views: Number(row?.views ?? 0),
    opens: Number(row?.opens ?? 0),
    saves: Number(row?.saves ?? 0),
    planAdds: Number(row?.plan_adds ?? 0),
    ctaClicks: Number(row?.cta_clicks ?? 0),
  };
}

/**
 * Агрегированные метрики для вкладки Analytics → Overview.
 * Contract v1: views = canonical content CARD_VIEW impressions only;
 * PAGE_VIEW stays in traffic analytics, and article read/rating transport
 * events never inflate CTA conversion metrics.
 */
export async function getAnalyticsOverview(
  filters: AnalyticsOverviewFilters,
): Promise<AnalyticsOverviewResult> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const allowed = await resolveAnalyticsAllowedUserIds(filters);
  const baseUnfiltered = buildBaseWhere(start, end, filters, cityId);
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

  // Contract v1 follows the publication funnel: impression → open → save → plan.
  // Null means the rate is not measurable because its denominator is zero.
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
