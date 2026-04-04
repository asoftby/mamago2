import type {
  AnalyticsEntityType,
  AnalyticsVertical,
  Prisma,
  UserEventType,
} from "@prisma/client";
import {
  eachDayOfInterval,
  endOfDay,
  min as minDate,
  startOfDay,
  subDays,
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

const VIEW_TYPES: UserEventType[] = ["PAGE_VIEW", "CARD_VIEW"];

async function countByType(
  base: Prisma.UserEventWhereInput,
  types: UserEventType | UserEventType[],
): Promise<number> {
  const t = Array.isArray(types) ? { in: types } : types;
  return prisma.userEvent.count({
    where: { ...base, eventType: t },
  });
}

/**
 * Агрегированные метрики для вкладки Analytics → Overview.
 */
export async function getAnalyticsOverview(
  filters: AnalyticsOverviewFilters,
): Promise<AnalyticsOverviewResult> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const base = buildBaseWhere(start, end, filters, cityId);

  const [
    views,
    opens,
    saves,
    planAdds,
    ctaClicks,
    activeUserRows,
    sessionRows,
    profilesActiveInRange,
    topVerticalRows,
    topEntityRows,
  ] = await Promise.all([
    countByType(base, VIEW_TYPES),
    countByType(base, "DETAIL_OPEN"),
    countByType(base, "SAVE"),
    countByType(base, "PLAN_ADD"),
    countByType(base, "CTA_CLICK"),
    prisma.userEvent.groupBy({
      by: ["userId"],
      where: { ...base, userId: { not: null } },
    }),
    prisma.userEvent.groupBy({
      by: ["sessionId"],
      where: { ...base, sessionId: { not: null } },
    }),
    prisma.userBehaviorProfile.count({
      where: {
        lastSeenAt: { gte: start, lte: end },
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

  const activeUsers = activeUserRows.length;
  const sessions = sessionRows.length;

  const denomViews = Math.max(views, 1);
  const denomSaves = Math.max(saves, 1);
  const saveRate = saves / denomViews;
  const planRate = planAdds / denomSaves;
  const clickRate = ctaClicks / denomViews;

  const top = Math.max(views, 1);
  const funnel = [
    {
      key: "view" as const,
      label: "Views",
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
      const dayWhere: Prisma.UserEventWhereInput = {
        ...base,
        createdAt: { gte: ds, lte: de },
      };
      const [v, o] = await Promise.all([
        prisma.userEvent.count({
          where: { ...dayWhere, eventType: { in: VIEW_TYPES } },
        }),
        prisma.userEvent.count({
          where: { ...dayWhere, eventType: "DETAIL_OPEN" },
        }),
      ]);
      return {
        day: ds.toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
        date: ds.toISOString().slice(0, 10),
        views: v,
        opens: o,
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
