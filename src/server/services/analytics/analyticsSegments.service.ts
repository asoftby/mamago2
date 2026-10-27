import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSegmentKey, SEGMENT_KEYS } from "@/lib/analytics/segmentCatalog";
import type {
  AnalyticsSegmentDetailResult,
  AnalyticsSegmentRow,
  AnalyticsSegmentsFilters,
} from "@/lib/analytics/analyticsSegmentsTypes";
import { resolveCompletedWindow } from "@/lib/performance/performanceMetrics";
import {
  analyticsDayKeys,
  resolveAnalyticsDateRange,
  resolveCityIdFromSlug,
} from "@/server/services/analytics/analyticsDateRange";
import { AUDIENCE_EXCLUDED_ROLES } from "@/server/services/analytics/canonicalAudience";
import {
  ANALYTICS_TIME_ZONE,
  CTA_CLICK_EVENT,
  DETAIL_OPEN_EVENT,
  FEED_IMPRESSION_EVENT,
  PLAN_ADD_EVENT,
  SAVE_EVENT,
} from "@/server/services/analytics/metricDefinitions";

// "createdAt" is timestamp WITHOUT time zone holding UTC: read it as UTC first, then convert to Minsk wall time.
const MINSK_TZ = Prisma.raw(`'${ANALYTICS_TIME_ZONE}'`);
const STAFF_ROLES_SQL = Prisma.join([...AUDIENCE_EXCLUDED_ROLES]);

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

/** Percent change of active users vs the previous window; null when there is no previous activity to compare with. */
export function trendPct(activeNow: number, activePrev: number): number | null {
  if (activePrev <= 0) return null;
  return Math.round(((activeNow - activePrev) / activePrev) * 1000) / 10;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * SQL membership of "users in the selected period": a non-staff profile
 * last seen inside [start, end] and, with a city filter, with at least one
 * event in that city inside the period. Expects aliases p = UserBehaviorProfile,
 * u = User.
 */
function periodMemberSql(start: Date, end: Date, cityId: string | null): Prisma.Sql {
  const city = cityId
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "UserEvent" ce
        WHERE ce."userId" = p."userId" AND ce."cityId" = ${cityId}
          AND ce."createdAt" >= ${start} AND ce."createdAt" <= ${end}
      )`
    : Prisma.empty;
  return Prisma.sql`u.role NOT IN (${STAFF_ROLES_SQL}) AND p."lastSeenAt" >= ${start} AND p."lastSeenAt" <= ${end} ${city}`;
}

type SegmentUserRow = {
  segmentKeys: string[];
  inPeriod: boolean;
  saves: bigint;
  planAdds: bigint;
  ctaClicks: bigint;
  active7: boolean;
  active7Prev: boolean;
  active30: boolean;
  active30Prev: boolean;
};

type SegmentAgg = {
  users: number;
  sumSaves: number;
  sumPlan: number;
  sumCta: number;
  active7: number;
  prev7: number;
  active30: number;
  prev30: number;
};

const emptyAgg = (): SegmentAgg => ({
  users: 0,
  sumSaves: 0,
  sumPlan: 0,
  sumCta: 0,
  active7: 0,
  prev7: 0,
  active30: 0,
  prev30: 0,
});

/**
 * Список сегментов.
 *
 * Состав сегмента — по `UserBehaviorProfile.segmentKeys` (профиль), а ВСЕ
 * числа поведения — по `UserEvent`:
 *  - «Пользователей» — профили, чей последний визит попал в выбранный период;
 *  - средние сохранения / в план / переходы — события пользователей сегмента
 *    за ВЫБРАННЫЙ период, делённые на число пользователей (D3);
 *  - тренд 7д / 30д — активные пользователи сегмента (хотя бы одно событие)
 *    в последних 7 / 30 завершённых минских сутках против предыдущих,
 *    независимо от выбранного периода; без активности в предыдущем окне — null (D1).
 */
export async function getAnalyticsSegments(
  filters: AnalyticsSegmentsFilters,
  now: Date = new Date(),
): Promise<{ totalProfiles: number; segments: AnalyticsSegmentRow[] }> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange, now);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const w7 = resolveCompletedWindow(7, now);
  const w30 = resolveCompletedWindow(30, now);
  const minStart = new Date(Math.min(start.getTime(), w7.previousStart.getTime(), w30.previousStart.getTime()));
  const cityEvent = cityId ? Prisma.sql`AND e."cityId" = ${cityId}` : Prisma.empty;
  const inRange = Prisma.sql`e."createdAt" >= ${start} AND e."createdAt" <= ${end}`;
  const inWindow = (w: { start: Date; end: Date }) =>
    Prisma.sql`COALESCE(BOOL_OR(e."createdAt" >= ${w.start} AND e."createdAt" <= ${w.end}), false)`;

  const rows = await prisma.$queryRaw<SegmentUserRow[]>`
    SELECT p."segmentKeys" AS "segmentKeys",
      (${periodMemberSql(start, end, cityId)}) AS "inPeriod",
      COUNT(e.id) FILTER (WHERE e."eventType" = ${SAVE_EVENT}::"UserEventType" AND ${inRange})::bigint AS saves,
      COUNT(e.id) FILTER (WHERE e."eventType" = ${PLAN_ADD_EVENT}::"UserEventType" AND ${inRange})::bigint AS "planAdds",
      COUNT(e.id) FILTER (WHERE e."eventType" = ${CTA_CLICK_EVENT}::"UserEventType" AND ${inRange})::bigint AS "ctaClicks",
      ${inWindow(w7)} AS "active7",
      ${inWindow({ start: w7.previousStart, end: w7.previousEnd })} AS "active7Prev",
      ${inWindow(w30)} AS "active30",
      ${inWindow({ start: w30.previousStart, end: w30.previousEnd })} AS "active30Prev"
    FROM "UserBehaviorProfile" p
    JOIN "User" u ON u.id = p."userId"
    LEFT JOIN "UserEvent" e
      ON e."userId" = p."userId" AND e."createdAt" >= ${minStart} AND e."createdAt" <= ${now} ${cityEvent}
    WHERE u.role NOT IN (${STAFF_ROLES_SQL}) AND p."lastSeenAt" >= ${minStart}
    GROUP BY p."userId", p."segmentKeys", p."lastSeenAt", u.role
  `;

  const byKey = new Map<string, SegmentAgg>(SEGMENT_KEYS.map((k) => [k, emptyAgg()]));
  let totalProfiles = 0;
  for (const row of rows) {
    if (row.inPeriod) totalProfiles += 1;
    for (const key of row.segmentKeys) {
      const agg = byKey.get(key) ?? emptyAgg();
      byKey.set(key, agg);
      // Trends count activity of segment members regardless of the selected period.
      if (row.active7) agg.active7 += 1;
      if (row.active7Prev) agg.prev7 += 1;
      if (row.active30) agg.active30 += 1;
      if (row.active30Prev) agg.prev30 += 1;
      if (!row.inPeriod) continue;
      agg.users += 1;
      agg.sumSaves += Number(row.saves);
      agg.sumPlan += Number(row.planAdds);
      agg.sumCta += Number(row.ctaClicks);
    }
  }

  const segments: AnalyticsSegmentRow[] = SEGMENT_KEYS.map((key) => {
    const a = byKey.get(key)!;
    return {
      key,
      usersCount: a.users,
      share: totalProfiles > 0 ? Math.round((a.users / totalProfiles) * 10000) / 10000 : 0,
      avgSaves: a.users > 0 ? round2(a.sumSaves / a.users) : 0,
      avgPlanAdds: a.users > 0 ? round2(a.sumPlan / a.users) : 0,
      avgCtaClicks: a.users > 0 ? round2(a.sumCta / a.users) : 0,
      trend7d: trendPct(a.active7, a.prev7),
      trend30d: trendPct(a.active30, a.prev30),
    };
  });

  return { totalProfiles, segments };
}

/**
 * Детализация сегмента. График — дневные активные пользователи сегмента по
 * `UserEvent` (минские сутки, D2); средние и воронка — события за выбранный
 * период (D3), а не накопленные за всё время счётчики профиля.
 */
export async function getAnalyticsSegmentDetail(
  segmentKey: string,
  filters: AnalyticsSegmentsFilters,
  now: Date = new Date(),
): Promise<AnalyticsSegmentDetailResult | null> {
  const normalized = decodeURIComponent(segmentKey)
    .toUpperCase()
    .replace(/-/g, "_");
  if (!isSegmentKey(normalized)) {
    return null;
  }
  const key = normalized;

  const { start, end } = resolveAnalyticsDateRange(filters.dateRange, now);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const cityEvent = cityId ? Prisma.sql`AND e."cityId" = ${cityId}` : Prisma.empty;
  const member = Prisma.sql`${key} = ANY(p."segmentKeys")`;
  const periodMember = periodMemberSql(start, end, cityId);

  const [rows, dailyRows, eventCounts] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        userId: string;
        preferredCategories: Prisma.JsonValue | null;
        preferredVerticals: Prisma.JsonValue | null;
        preferredFormats: Prisma.JsonValue | null;
      }>
    >`
      SELECT p."userId" AS "userId", p."preferredCategories" AS "preferredCategories",
        p."preferredVerticals" AS "preferredVerticals", p."preferredFormats" AS "preferredFormats"
      FROM "UserBehaviorProfile" p
      JOIN "User" u ON u.id = p."userId"
      WHERE ${member} AND ${periodMember}
    `,
    prisma.$queryRaw<Array<{ day: string; users: bigint }>>`
      SELECT to_char((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${MINSK_TZ}, 'YYYY-MM-DD') AS day,
        COUNT(DISTINCT e."userId")::bigint AS users
      FROM "UserEvent" e
      JOIN "UserBehaviorProfile" p ON p."userId" = e."userId"
      JOIN "User" u ON u.id = e."userId"
      WHERE e."createdAt" >= ${start} AND e."createdAt" <= ${end}
        AND ${member} AND u.role NOT IN (${STAFF_ROLES_SQL}) ${cityEvent}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ eventType: string; c: bigint }>>`
      SELECT e."eventType"::text AS "eventType", COUNT(*)::bigint AS c
      FROM "UserEvent" e
      JOIN "UserBehaviorProfile" p ON p."userId" = e."userId"
      JOIN "User" u ON u.id = e."userId"
      WHERE e."createdAt" >= ${start} AND e."createdAt" <= ${end}
        AND e."eventType" IN (
          ${FEED_IMPRESSION_EVENT}::"UserEventType", ${DETAIL_OPEN_EVENT}::"UserEventType",
          ${SAVE_EVENT}::"UserEventType", ${PLAN_ADD_EVENT}::"UserEventType", ${CTA_CLICK_EVENT}::"UserEventType")
        AND ${member} AND ${periodMember} ${cityEvent}
      GROUP BY 1
    `,
  ]);

  const usersCount = rows.length;
  const count = (type: string) => Number(eventCounts.find((r) => r.eventType === type)?.c ?? 0);
  const funnel = {
    views: count(FEED_IMPRESSION_EVENT),
    opens: count(DETAIL_OPEN_EVENT),
    saves: count(SAVE_EVENT),
    planAdds: count(PLAN_ADD_EVENT),
    ctaClicks: count(CTA_CLICK_EVENT),
  };

  const activeByDay = new Map(dailyRows.map((r) => [r.day, Number(r.users)]));
  const trend = analyticsDayKeys(start, end, 90).map((date) => ({ date, usersCount: activeByDay.get(date) ?? 0 }));

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

  const denom = Math.max(1, usersCount);
  return {
    key,
    range: { start: start.toISOString(), end: end.toISOString() },
    usersCount,
    trend,
    avgSaves: round2(funnel.saves / denom),
    avgPlanAdds: round2(funnel.planAdds / denom),
    avgCtaClicks: round2(funnel.ctaClicks / denom),
    topCategories: topFromMap(mergeCountMaps(rows), 8),
    topFormats: topFromMap(mergeFormatMaps(rows), 8),
    topVerticals: topFromMap(mergeVerticalMaps(rows), 8),
    topContent,
    funnel,
  };
}
