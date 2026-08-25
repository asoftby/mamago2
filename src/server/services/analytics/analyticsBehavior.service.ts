import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import type {
  AnalyticsBehaviorResult,
  BehaviorActivityByDay,
  BehaviorActivityByTime,
  BehaviorGapItem,
  BehaviorNamedBreakdown,
  BehaviorTimeBucket,
} from "@/lib/analytics/analyticsBehaviorTypes";
import { isCardImpression } from "@/lib/analytics/metricSemantics";
import {
  resolveAnalyticsDateRange,
  resolveCityIdFromSlug,
} from "@/server/services/analytics/analyticsDateRange";
import {
  analyticsEventWhereSql,
  applyAnalyticsUserFilter,
  buildAnalyticsBaseEventWhere,
  loadAllEntityTitles,
  resolveAnalyticsAllowedUserIds,
  youngestChildBandByUser,
} from "@/server/services/analytics/analyticsQueryHelpers";
import {
  CANONICAL_CARD_IMPRESSION_SQL,
  CANONICAL_CTA_CLICK_SQL,
} from "@/server/services/analytics/analyticsMetricSql";

function formatGroupKey(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes("active") || s.includes("fast") || s.includes("energy"))
    return "active";
  if (s.includes("education") || s.includes("learn")) return "educational";
  if (s.includes("creative") || s.includes("art")) return "creative";
  if (
    s.includes("calm") ||
    s.includes("aesthetics") ||
    s.includes("coffee") ||
    s.includes("family")
  )
    return "entertainment";
  if (s.includes("home") || s.includes("indoor")) return "entertainment";
  if (s.includes("outdoor")) return "active";
  return "entertainment";
}

const TIME_LABELS: Record<BehaviorTimeBucket, string> = {
  morning: "Morning (6–12 UTC)",
  day: "Day (12–18 UTC)",
  evening: "Evening (18–22 UTC)",
  night: "Night (22–6 UTC)",
};

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ORDERED_BUCKETS: BehaviorTimeBucket[] = [
  "morning",
  "day",
  "evening",
  "night",
];

export async function getAnalyticsBehavior(
  filters: AnalyticsOverviewFilters,
): Promise<AnalyticsBehaviorResult> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const allowed = await resolveAnalyticsAllowedUserIds(filters);

  if (allowed && allowed.size === 0) {
    return emptyBehaviorResult(start, end);
  }

  const baseWhere = buildAnalyticsBaseEventWhere(start, end, filters, cityId);
  const where = applyAnalyticsUserFilter(baseWhere, allowed);
  const wsql = analyticsEventWhereSql(start, end, filters, cityId, allowed);

  const [
    timeRows,
    dowRows,
    planningProfiles,
    planAddsTotal,
    planAddsNextDay,
    gapAgg,
    distinctUsers,
  ] = await Promise.all([
    timeOfDayBuckets(wsql),
    dayOfWeekBuckets(wsql),
    planningProfileStats(where),
    prisma.userEvent.count({ where: { ...where, eventType: "PLAN_ADD" } }),
    countPlanAddsNextDay(wsql),
    entityFunnelAggregates(wsql),
    prisma.userEvent.findMany({
      where: { ...where, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const userIds = distinctUsers.map((r) => r.userId!);
  const [ageBreakdown, signalsBreakdown, categoryBreakdown, formatBreakdown] =
    await Promise.all([
      ageBandStats(where),
      signalsFormatFromUsers(userIds, "signals"),
      categoryFromProfiles(userIds),
      signalsFormatFromUsers(userIds, "formats"),
    ]);

  const interactionGaps = await buildInteractionGaps(gapAgg);
  const vertMetrics = await verticalMetrics(wsql);

  const nextDayShare =
    planAddsTotal > 0 ? planAddsNextDay / planAddsTotal : null;

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    timezoneNote: "Time-of-day buckets use UTC.",
    activityByTime: timeRows,
    activityByDay: dowRows,
    planning: {
      sameDayShare: planningProfiles.avgSame,
      nextDayShare,
      advanceShare: planningProfiles.avgAdvance,
      weekendShare: planningProfiles.avgWeekend,
    },
    interactionGaps,
    ageBreakdown,
    signalsBreakdown,
    categoryBreakdown,
    formatBreakdown,
    verticalBreakdown: vertMetrics,
  };
}

async function countPlanAddsNextDay(wsql: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c
    FROM "UserEvent" e
    WHERE ${wsql}
      AND e."eventType" = 'PLAN_ADD'
      AND (e.meta->>'planningTiming') = 'next_day'
  `;
  return Number(rows[0]?.c ?? BigInt(0));
}

async function timeOfDayBuckets(
  wsql: Prisma.Sql,
): Promise<BehaviorActivityByTime[]> {
  const rows = await prisma.$queryRaw<
    Array<{ bucket: string; events: bigint; sessions: bigint }>
  >`
    SELECT sub.bucket,
           COUNT(*)::bigint AS events,
           COUNT(DISTINCT sub."sessionId")::bigint AS sessions
    FROM (
      SELECT
        e."sessionId",
        CASE
          WHEN EXTRACT(HOUR FROM e."createdAt" AT TIME ZONE 'UTC') BETWEEN 6 AND 11 THEN 'morning'
          WHEN EXTRACT(HOUR FROM e."createdAt" AT TIME ZONE 'UTC') BETWEEN 12 AND 17 THEN 'day'
          WHEN EXTRACT(HOUR FROM e."createdAt" AT TIME ZONE 'UTC') BETWEEN 18 AND 21 THEN 'evening'
          ELSE 'night'
        END AS bucket
      FROM "UserEvent" e
      WHERE ${wsql}
    ) sub
    GROUP BY sub.bucket
  `;
  const map = new Map(rows.map((r) => [r.bucket, r]));
  return ORDERED_BUCKETS.map((k) => {
    const r = map.get(k);
    return {
      key: k,
      label: TIME_LABELS[k],
      events: Number(r?.events ?? BigInt(0)),
      sessions: Number(r?.sessions ?? BigInt(0)),
    };
  });
}

async function dayOfWeekBuckets(
  wsql: Prisma.Sql,
): Promise<BehaviorActivityByDay[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      dow: number;
      events: bigint;
      sessions: bigint;
      users: bigint;
    }>
  >`
    SELECT
      EXTRACT(ISODOW FROM e."createdAt" AT TIME ZONE 'UTC')::int AS dow,
      COUNT(*)::bigint AS events,
      COUNT(DISTINCT e."sessionId")::bigint AS sessions,
      COUNT(DISTINCT e."userId")::bigint AS users
    FROM "UserEvent" e
    WHERE ${wsql}
    GROUP BY 1
    ORDER BY 1
  `;
  const map = new Map(rows.map((r) => [r.dow, r]));
  return DOW_LABELS.map((label, i) => {
    const dow = i + 1;
    const r = map.get(dow);
    return {
      isoDow: dow,
      label,
      events: Number(r?.events ?? BigInt(0)),
      sessions: Number(r?.sessions ?? BigInt(0)),
      activeUsers: Number(r?.users ?? BigInt(0)),
    };
  });
}

async function planningProfileStats(where: Prisma.UserEventWhereInput): Promise<{
  avgSame: number;
  avgAdvance: number;
  avgWeekend: number;
}> {
  const distinct = await prisma.userEvent.findMany({
    where: { ...where, userId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const ids = distinct.map((d) => d.userId!);
  if (ids.length === 0) {
    return { avgSame: 0, avgAdvance: 0, avgWeekend: 0 };
  }
  const profiles = await prisma.userBehaviorProfile.findMany({
    where: { userId: { in: ids } },
    select: {
      sameDayPlanningShare: true,
      advancePlanningShare: true,
      weekendShare: true,
    },
  });
  if (profiles.length === 0) {
    return { avgSame: 0, avgAdvance: 0, avgWeekend: 0 };
  }
  const n = profiles.length;
  const avgSame =
    profiles.reduce((a, p) => a + p.sameDayPlanningShare, 0) / n;
  const avgAdvance =
    profiles.reduce((a, p) => a + p.advancePlanningShare, 0) / n;
  const avgWeekend =
    profiles.reduce((a, p) => a + p.weekendShare, 0) / n;
  return { avgSame, avgAdvance, avgWeekend };
}

type GapRow = {
  entityType: string;
  entityId: string;
  opens: bigint;
  saves: bigint;
  plans: bigint;
  ctas: bigint;
};

async function entityFunnelAggregates(wsql: Prisma.Sql): Promise<GapRow[]> {
  return prisma.$queryRaw<GapRow[]>`
    SELECT
      e."entityType"::text AS "entityType",
      e."entityId"::text AS "entityId",
      SUM(CASE WHEN e."eventType" = 'DETAIL_OPEN' THEN 1 ELSE 0 END)::bigint AS opens,
      SUM(CASE WHEN e."eventType" = 'SAVE' THEN 1 ELSE 0 END)::bigint AS saves,
      SUM(CASE WHEN e."eventType" = 'PLAN_ADD' THEN 1 ELSE 0 END)::bigint AS plans,
      SUM(CASE WHEN ${CANONICAL_CTA_CLICK_SQL} THEN 1 ELSE 0 END)::bigint AS ctas
    FROM "UserEvent" e
    WHERE ${wsql}
      AND e."entityId" IS NOT NULL
      AND e."entityType" IS NOT NULL
    GROUP BY e."entityType", e."entityId"
  `;
}

async function buildInteractionGaps(rows: GapRow[]): Promise<{
  openNoSave: BehaviorGapItem[];
  saveNoPlan: BehaviorGapItem[];
  planNoClick: BehaviorGapItem[];
}> {
  const withRates = rows.map((r) => {
    const opens = Number(r.opens);
    const saves = Number(r.saves);
    const plans = Number(r.plans);
    const ctas = Number(r.ctas);
    return {
      entityType: r.entityType,
      entityId: r.entityId,
      opens,
      saves,
      plans,
      ctas,
      saveRate: opens > 0 ? saves / opens : 0,
      planRate: saves > 0 ? plans / saves : 0,
      clickRate: plans > 0 ? ctas / plans : 0,
    };
  });

  const openNoSave = withRates
    .filter((x) => x.opens >= 8 && x.saveRate < 0.2)
    .sort((a, b) => b.opens - a.opens)
    .slice(0, 10);

  const saveNoPlan = withRates
    .filter((x) => x.saves >= 5 && x.planRate < 0.25)
    .sort((a, b) => b.saves - a.saves)
    .slice(0, 10);

  const planNoClick = withRates
    .filter((x) => x.plans >= 4 && x.clickRate < 0.35)
    .sort((a, b) => b.plans - a.plans)
    .slice(0, 10);

  const allKeys = [...openNoSave, ...saveNoPlan, ...planNoClick].map((x) => ({
    entityType: x.entityType,
    entityId: x.entityId,
  }));
  const titles = await loadAllEntityTitles(allKeys);

  const toGap = (
    list: typeof withRates,
    pick: (x: (typeof withRates)[number]) => Pick<
      BehaviorGapItem,
      "metricA" | "metricB" | "rate"
    >,
  ): BehaviorGapItem[] =>
    list.map((x) => ({
      entityType: x.entityType,
      entityId: x.entityId,
      title:
        titles.get(`${x.entityType}:${x.entityId}`) ??
        `${x.entityType} ${x.entityId.slice(0, 8)}…`,
      ...pick(x),
    }));

  return {
    openNoSave: toGap(openNoSave, (x) => ({
      metricA: x.opens,
      metricB: x.saves,
      rate: x.saveRate,
    })),
    saveNoPlan: toGap(saveNoPlan, (x) => ({
      metricA: x.saves,
      metricB: x.plans,
      rate: x.planRate,
    })),
    planNoClick: toGap(planNoClick, (x) => ({
      metricA: x.plans,
      metricB: x.ctas,
      rate: x.clickRate,
    })),
  };
}

async function ageBandStats(
  where: Prisma.UserEventWhereInput,
): Promise<AnalyticsBehaviorResult["ageBreakdown"]> {
  const bandMap = await youngestChildBandByUser();
  const events = await prisma.userEvent.findMany({
    where: { ...where, userId: { not: null } },
    select: { userId: true, eventType: true, meta: true },
  });
  const acc: Record<string, { views: number; saves: number; planAdds: number }> =
    {
      "0-3": { views: 0, saves: 0, planAdds: 0 },
      "3-6": { views: 0, saves: 0, planAdds: 0 },
      "6-10": { views: 0, saves: 0, planAdds: 0 },
      "10+": { views: 0, saves: 0, planAdds: 0 },
      unknown: { views: 0, saves: 0, planAdds: 0 },
    };
  for (const e of events) {
    const uid = e.userId!;
    const band = bandMap.get(uid) ?? "unknown";
    const b = acc[band] ?? acc.unknown;
    if (isCardImpression(e.eventType, e.meta)) b.views += 1;
    if (e.eventType === "SAVE") b.saves += 1;
    if (e.eventType === "PLAN_ADD") b.planAdds += 1;
  }
  return (["0-3", "3-6", "6-10", "10+", "unknown"] as const).map((band) => ({
    band,
    views: acc[band]?.views ?? 0,
    saves: acc[band]?.saves ?? 0,
    planAdds: acc[band]?.planAdds ?? 0,
  }));
}

async function categoryFromProfiles(
  userIds: string[],
): Promise<BehaviorNamedBreakdown[]> {
  if (userIds.length === 0) return [];
  const profiles = await prisma.userBehaviorProfile.findMany({
    where: { userId: { in: userIds } },
    select: {
      preferredCategories: true,
      totalViews: true,
      totalSaves: true,
      totalPlanAdds: true,
    },
  });
  const legacyEntityKeys = new Set(["EVENT", "PLACE", "OFFER", "ROUTE", "ARTICLE"]);
  const catMap: Record<string, { v: number }> = {};
  for (const p of profiles) {
    const raw = p.preferredCategories;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
      if (k === "_none" || legacyEntityKeys.has(k)) continue;
      const weight = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(weight) || weight <= 0) continue;
      if (!catMap[k]) catMap[k] = { v: 0 };
      catMap[k].v += weight;
    }
  }
  const totalW = Object.values(catMap).reduce((a, x) => a + x.v, 0) || 1;
  const totalProfileViews = profiles.reduce((a, p) => a + p.totalViews, 0) || 1;
  const totalSaves = profiles.reduce((a, p) => a + p.totalSaves, 0) || 1;
  const totalPlans = profiles.reduce((a, p) => a + p.totalPlanAdds, 0) || 1;
  return Object.entries(catMap)
    .map(([key, w]) => ({
      key,
      label: key.replace(/_/g, " "),
      views: Math.round((w.v / totalW) * totalProfileViews),
      saves: Math.round((w.v / totalW) * totalSaves),
      planAdds: Math.round((w.v / totalW) * totalPlans),
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
}

async function signalsFormatFromUsers(
  userIds: string[],
  mode: "signals" | "formats",
): Promise<BehaviorNamedBreakdown[]> {
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { preferenceSignalIds: true, leisureFormatSignalId: true },
  });
  const idCounts = new Map<string, number>();
  for (const u of users) {
    for (const id of u.preferenceSignalIds) {
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
    if (u.leisureFormatSignalId) {
      const id = u.leisureFormatSignalId;
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
  }
  const ids = [...idCounts.keys()];
  const defs = await prisma.signalDefinition.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, parentId: true, title: true },
  });
  const defById = new Map(defs.map((d) => [d.id, d]));

  if (mode === "signals") {
    const bySlug: Record<string, number> = {};
    for (const [id, c] of idCounts) {
      const d = defById.get(id);
      if (!d?.slug) continue;
      if (d.slug.startsWith("leisure-format")) continue;
      bySlug[d.slug] = (bySlug[d.slug] ?? 0) + c;
    }
    return Object.entries(bySlug)
      .map(([key, count]) => ({
        key,
        label: key.replace(/-/g, " "),
        views: count,
        saves: count,
        planAdds: count,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  const formatGroups: Record<string, number> = {
    active: 0,
    educational: 0,
    creative: 0,
    entertainment: 0,
  };
  for (const [id, c] of idCounts) {
    const d = defById.get(id);
    if (!d?.slug) continue;
    const g = formatGroupKey(d.slug);
    formatGroups[g] = (formatGroups[g] ?? 0) + c;
  }
  const labels: Record<string, string> = {
    active: "Active / outdoor",
    educational: "Educational",
    creative: "Creative",
    entertainment: "Calm / entertainment",
  };
  return Object.entries(formatGroups)
    .map(([key, count]) => ({
      key,
      label: labels[key] ?? key,
      views: count,
      saves: count,
      planAdds: count,
    }))
    .filter((x) => x.views > 0)
    .sort((a, b) => b.views - a.views);
}

async function verticalMetrics(
  wsql: Prisma.Sql,
): Promise<BehaviorNamedBreakdown[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      vertical: string;
      views: bigint;
      saves: bigint;
      plan_adds: bigint;
      cta_clicks: bigint;
    }>
  >`
    SELECT
      e."vertical"::text AS vertical,
      COUNT(*) FILTER (WHERE ${CANONICAL_CARD_IMPRESSION_SQL})::bigint AS views,
      COUNT(*) FILTER (WHERE e."eventType" = 'SAVE')::bigint AS saves,
      COUNT(*) FILTER (WHERE e."eventType" = 'PLAN_ADD')::bigint AS plan_adds,
      COUNT(*) FILTER (WHERE ${CANONICAL_CTA_CLICK_SQL})::bigint AS cta_clicks
    FROM "UserEvent" e
    WHERE ${wsql}
      AND e."vertical" IS NOT NULL
    GROUP BY e."vertical"
  `;

  return rows
    .map((r) => ({
      key: r.vertical,
      label: r.vertical,
      views: Number(r.views),
      saves: Number(r.saves),
      planAdds: Number(r.plan_adds),
      ctaClicks: Number(r.cta_clicks),
    }))
    .sort((a, b) => b.views - a.views);
}

function emptyBehaviorResult(
  start: Date,
  end: Date,
): AnalyticsBehaviorResult {
  const z = (k: BehaviorTimeBucket): BehaviorActivityByTime => ({
    key: k,
    label: TIME_LABELS[k],
    events: 0,
    sessions: 0,
  });
  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    timezoneNote: "UTC",
    activityByTime: ORDERED_BUCKETS.map(z),
    activityByDay: DOW_LABELS.map((label, i) => ({
      isoDow: i + 1,
      label,
      events: 0,
      sessions: 0,
      activeUsers: 0,
    })),
    planning: {
      sameDayShare: 0,
      nextDayShare: null,
      advanceShare: 0,
      weekendShare: 0,
    },
    interactionGaps: { openNoSave: [], saveNoPlan: [], planNoClick: [] },
    ageBreakdown: [],
    signalsBreakdown: [],
    categoryBreakdown: [],
    formatBreakdown: [],
    verticalBreakdown: [],
  };
}
