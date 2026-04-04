import type { Prisma } from "@prisma/client";
import {
  eachDayOfInterval,
  endOfDay,
  startOfDay,
  subDays,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import { isSegmentKey, SEGMENT_KEYS } from "@/lib/analytics/segmentCatalog";
import type {
  AnalyticsSegmentDetailResult,
  AnalyticsSegmentRow,
  AnalyticsSegmentsFilters,
} from "@/lib/analytics/analyticsSegmentsTypes";
import {
  resolveAnalyticsDateRange,
  resolveCityIdFromSlug,
} from "@/server/services/analytics/analyticsDateRange";

function mergeCountMaps(
  rows: Array<{ preferredCategories: Prisma.JsonValue | null }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = r.preferredCategories;
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (k === "_none") continue;
      const c = typeof n === "number" ? n : Number(n);
      if (!Number.isFinite(c)) continue;
      out[k] = (out[k] ?? 0) + c;
    }
  }
  return out;
}

function mergeVerticalMaps(
  rows: Array<{ preferredVerticals: Prisma.JsonValue | null }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = r.preferredVerticals;
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (k === "_none") continue;
      const c = typeof n === "number" ? n : Number(n);
      if (!Number.isFinite(c)) continue;
      out[k] = (out[k] ?? 0) + c;
    }
  }
  return out;
}

function mergeFormatMaps(
  rows: Array<{ preferredFormats: Prisma.JsonValue | null }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = r.preferredFormats;
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      const c = typeof n === "number" ? n : Number(n);
      if (!Number.isFinite(c)) continue;
      out[k] = (out[k] ?? 0) + c;
    }
  }
  return out;
}

function topFromMap(map: Record<string, number>, take: number) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([label, count]) => ({ label, count }));
}

async function userIdsActiveInCity(
  cityId: string,
  start: Date,
  end: Date,
): Promise<string[]> {
  const rows = await prisma.userEvent.findMany({
    where: {
      cityId,
      createdAt: { gte: start, lte: end },
      userId: { not: null },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.map((r) => r.userId!).filter(Boolean);
}

function trendPct(activeNow: number, activePrev: number): number {
  const prev = Math.max(1, activePrev);
  return Math.round(((activeNow - activePrev) / prev) * 1000) / 10;
}

/**
 * Список сегментов с агрегатами по UserBehaviorProfile.
 */
export async function getAnalyticsSegments(
  filters: AnalyticsSegmentsFilters,
): Promise<{ totalProfiles: number; segments: AnalyticsSegmentRow[] }> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const now = new Date();
  const d7 = startOfDay(subDays(now, 7));
  const d14 = startOfDay(subDays(now, 14));
  const d30 = startOfDay(subDays(now, 30));
  const d60 = startOfDay(subDays(now, 60));

  let cityUserIds: string[] | null = null;
  if (cityId) {
    cityUserIds = await userIdsActiveInCity(cityId, start, end);
    if (cityUserIds.length === 0) {
      return {
        totalProfiles: 0,
        segments: SEGMENT_KEYS.map((key) => ({
          key,
          usersCount: 0,
          share: 0,
          avgSaves: 0,
          avgPlanAdds: 0,
          avgCtaClicks: 0,
          trend7d: 0,
          trend30d: 0,
        })),
      };
    }
  }

  const baseWhere: Prisma.UserBehaviorProfileWhereInput = {
    lastSeenAt: { gte: start, lte: end },
    ...(cityUserIds ? { userId: { in: cityUserIds } } : {}),
  };

  const totalProfiles = await prisma.userBehaviorProfile.count({
    where: baseWhere,
  });

  const profiles = await prisma.userBehaviorProfile.findMany({
    where: baseWhere,
    select: {
      segmentKeys: true,
      totalSaves: true,
      totalPlanAdds: true,
      totalCtaClicks: true,
      lastSeenAt: true,
    },
  });

  const byKey = new Map<
    string,
    {
      users: number;
      sumSaves: number;
      sumPlan: number;
      sumCta: number;
      last7: number;
      prev7: number;
      last30: number;
      prev30: number;
    }
  >();

  for (const k of SEGMENT_KEYS) {
    byKey.set(k, {
      users: 0,
      sumSaves: 0,
      sumPlan: 0,
      sumCta: 0,
      last7: 0,
      prev7: 0,
      last30: 0,
      prev30: 0,
    });
  }

  for (const p of profiles) {
    const ls = p.lastSeenAt;
    const inLast7 = ls && ls >= d7;
    const inPrev7 = ls && ls >= d14 && ls < d7;
    const inLast30 = ls && ls >= d30;
    const inPrev30 = ls && ls >= d60 && ls < d30;

    for (const key of p.segmentKeys) {
      if (!byKey.has(key)) {
        byKey.set(key, {
          users: 0,
          sumSaves: 0,
          sumPlan: 0,
          sumCta: 0,
          last7: 0,
          prev7: 0,
          last30: 0,
          prev30: 0,
        });
      }
      const agg = byKey.get(key)!;
      agg.users += 1;
      agg.sumSaves += p.totalSaves;
      agg.sumPlan += p.totalPlanAdds;
      agg.sumCta += p.totalCtaClicks;
      if (inLast7) agg.last7 += 1;
      if (inPrev7) agg.prev7 += 1;
      if (inLast30) agg.last30 += 1;
      if (inPrev30) agg.prev30 += 1;
    }
  }

  const denom = Math.max(1, totalProfiles);
  const segments: AnalyticsSegmentRow[] = SEGMENT_KEYS.map((key) => {
    const a = byKey.get(key)!;
    const avgUsers = Math.max(1, a.users);
    return {
      key,
      usersCount: a.users,
      share: Math.round((a.users / denom) * 10000) / 10000,
      avgSaves: Math.round((a.sumSaves / avgUsers) * 100) / 100,
      avgPlanAdds: Math.round((a.sumPlan / avgUsers) * 100) / 100,
      avgCtaClicks: Math.round((a.sumCta / avgUsers) * 100) / 100,
      trend7d: trendPct(a.last7, a.prev7),
      trend30d: trendPct(a.last30, a.prev30),
    };
  });

  return { totalProfiles, segments };
}

/**
 * Детализация сегмента: агрегаты профиля + срез UserEvent для топ контента.
 */
export async function getAnalyticsSegmentDetail(
  segmentKey: string,
  filters: AnalyticsSegmentsFilters,
): Promise<AnalyticsSegmentDetailResult | null> {
  const normalized = decodeURIComponent(segmentKey)
    .toUpperCase()
    .replace(/-/g, "_");
  if (!isSegmentKey(normalized)) {
    return null;
  }
  const key = normalized;

  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);

  let cityUserIds: string[] | null = null;
  if (cityId) {
    cityUserIds = await userIdsActiveInCity(cityId, start, end);
    if (cityUserIds.length === 0) {
      return {
        key,
        range: { start: start.toISOString(), end: end.toISOString() },
        usersCount: 0,
        trend: [],
        avgSaves: 0,
        avgPlanAdds: 0,
        avgCtaClicks: 0,
        topCategories: [],
        topFormats: [],
        topVerticals: [],
        topContent: [],
        funnel: {
          views: 0,
          opens: 0,
          saves: 0,
          planAdds: 0,
          ctaClicks: 0,
        },
      };
    }
  }

  const baseWhere: Prisma.UserBehaviorProfileWhereInput = {
    lastSeenAt: { gte: start, lte: end },
    segmentKeys: { has: key },
    ...(cityUserIds ? { userId: { in: cityUserIds } } : {}),
  };

  const rows = await prisma.userBehaviorProfile.findMany({
    where: baseWhere,
    select: {
      totalViews: true,
      totalOpens: true,
      totalSaves: true,
      totalPlanAdds: true,
      totalCtaClicks: true,
      preferredCategories: true,
      preferredVerticals: true,
      preferredFormats: true,
      lastSeenAt: true,
      userId: true,
    },
  });

  const usersCount = rows.length;
  const denom = Math.max(1, usersCount);

  const funnel = {
    views: rows.reduce((a, r) => a + r.totalViews, 0),
    opens: rows.reduce((a, r) => a + r.totalOpens, 0),
    saves: rows.reduce((a, r) => a + r.totalSaves, 0),
    planAdds: rows.reduce((a, r) => a + r.totalPlanAdds, 0),
    ctaClicks: rows.reduce((a, r) => a + r.totalCtaClicks, 0),
  };

  const trendDays = eachDayOfInterval({
    start: startOfDay(start),
    end: startOfDay(end),
  }).slice(-90);

  const trend = trendDays.map((day) => {
    const ds = startOfDay(day);
    const next = endOfDay(ds);
    const c = rows.filter(
      (r) =>
        r.lastSeenAt &&
        r.lastSeenAt >= ds &&
        r.lastSeenAt <= next,
    ).length;
    return {
      date: ds.toISOString().slice(0, 10),
      usersCount: c,
    };
  });

  const userIds = rows.map((r) => r.userId);

  const topContentRaw =
    userIds.length > 0
      ? await prisma.userEvent.groupBy({
          by: ["entityType", "entityId"],
          where: {
            userId: { in: userIds },
            createdAt: { gte: start, lte: end },
            entityType: { not: null },
            entityId: { not: null },
          },
          _count: { _all: true },
          orderBy: { _count: { entityId: "desc" } },
          take: 15,
        })
      : [];

  const activityIds = topContentRaw
    .filter((x) => x.entityType === "EVENT" && x.entityId)
    .map((x) => x.entityId!);
  const placeIds = topContentRaw
    .filter((x) => x.entityType === "PLACE" && x.entityId)
    .map((x) => x.entityId!);

  const [activities, places] = await Promise.all([
    activityIds.length
      ? prisma.activity.findMany({
          where: { id: { in: activityIds } },
          select: { id: true, title: true },
        })
      : [],
    placeIds.length
      ? prisma.place.findMany({
          where: { id: { in: placeIds } },
          select: { id: true, title: true },
        })
      : [],
  ]);
  const titleMap = new Map<string, string>();
  for (const a of activities) titleMap.set(`EVENT:${a.id}`, a.title);
  for (const p of places) titleMap.set(`PLACE:${p.id}`, p.title);

  const topContent = topContentRaw.map((x) => {
    const et = x.entityType ?? "?";
    const id = x.entityId ?? "";
    const t = titleMap.get(`${et}:${id}`);
    return {
      entityType: et,
      entityId: id,
      title:
        t ??
        `${et} ${id.length > 10 ? `${id.slice(0, 8)}…` : id}`,
      eventsCount: x._count._all,
    };
  });

  return {
    key,
    range: { start: start.toISOString(), end: end.toISOString() },
    usersCount,
    trend,
    avgSaves:
      Math.round(
        (rows.reduce((a, r) => a + r.totalSaves, 0) / denom) * 100,
      ) / 100,
    avgPlanAdds:
      Math.round(
        (rows.reduce((a, r) => a + r.totalPlanAdds, 0) / denom) * 100,
      ) / 100,
    avgCtaClicks:
      Math.round(
        (rows.reduce((a, r) => a + r.totalCtaClicks, 0) / denom) * 100,
      ) / 100,
    topCategories: topFromMap(mergeCountMaps(rows), 8),
    topFormats: topFromMap(mergeFormatMaps(rows), 8),
    topVerticals: topFromMap(mergeVerticalMaps(rows), 8),
    topContent,
    funnel,
  };
}
