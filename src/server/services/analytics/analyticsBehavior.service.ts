import { youngestChildBirthByUser } from "@/server/family/familyAnalytics";
import {
  Prisma,
  type AnalyticsEntityType,
  type AnalyticsVertical,
  type UserEventType,
} from "@prisma/client";
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
import { loadAnalyticsScope } from "@/server/services/analytics/analyticsQueryHelpers";
import {
  internalTrafficExclusionSql,
  internalTrafficExclusionWhere,
  type InternalTrafficExclusion,
} from "@/server/services/analytics/canonicalAudience";
import {
  ANALYTICS_TIME_ZONE,
  FEED_IMPRESSION_EVENT,
  PAGE_VIEW_EVENT,
} from "@/server/services/analytics/metricDefinitions";

// "createdAt" is timestamp WITHOUT time zone holding UTC: read it as UTC first, then convert to Minsk wall time.
const MINSK_TZ = Prisma.raw(`'${ANALYTICS_TIME_ZONE}'`);

function entityMap(): Record<string, AnalyticsEntityType> {
  return {
    event: "EVENT",
    place: "PLACE",
    offer: "OFFER",
    route: "ROUTE",
    article: "ARTICLE",
  };
}

function verticalMap(): Record<string, AnalyticsVertical> {
  return {
    city: "CITY",
    travel: "TRAVEL",
    birthday: "BIRTHDAY",
    education: "EDUCATION",
    weekend: "WEEKEND",
    seasonal: "SEASONAL",
  };
}

function ageYearsFromBirth(birth: Date): number {
  const now = new Date();
  let y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) y--;
  return y;
}

function bandFromAgeYears(age: number): string {
  if (age < 0) return "unknown";
  if (age < 3) return "0-3";
  if (age < 6) return "3-6";
  if (age < 10) return "6-10";
  return "10+";
}

async function youngestChildBandByUser(): Promise<Map<string, string>> {
  const births = await youngestChildBirthByUser();
  const map = new Map<string, string>();
  for (const [userId, youngest] of births) {
    map.set(userId, bandFromAgeYears(ageYearsFromBirth(youngest)));
  }
  return map;
}

async function userIdsInSegment(segmentKey: string): Promise<Set<string>> {
  const rows = await prisma.userBehaviorProfile.findMany({
    where: { segmentKeys: { has: segmentKey } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

function intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  for (const x of a) {
    if (b.has(x)) out.add(x);
  }
  return out;
}

async function resolveAllowedUserIds(
  filters: AnalyticsOverviewFilters,
): Promise<Set<string> | null> {
  let seg: Set<string> | null = null;
  let age: Set<string> | null = null;

  if (filters.segment?.trim()) {
    seg = await userIdsInSegment(filters.segment.trim());
  }

  const band = filters.childAgeBand?.trim();
  if (band && band !== "all") {
    const yb = await youngestChildBandByUser();
    age = new Set<string>();
    for (const [uid, b] of yb) {
      if (b === band) age.add(uid);
    }
  }

  if (seg && age) return intersect(seg, age);
  if (seg) return seg;
  if (age) return age;
  return null;
}

function buildBaseEventWhere(
  start: Date,
  end: Date,
  filters: AnalyticsOverviewFilters,
  cityId: string | null,
  exclusion: InternalTrafficExclusion,
): Prisma.UserEventWhereInput {
  const w: Prisma.UserEventWhereInput = {
    createdAt: { gte: start, lte: end },
    ...internalTrafficExclusionWhere(exclusion),
  };
  if (cityId) w.cityId = cityId;
  if (filters.entity && filters.entity !== "all") {
    const em = entityMap()[filters.entity];
    if (em) w.entityType = em;
  }
  if (filters.vertical && filters.vertical !== "all") {
    const vm = verticalMap()[filters.vertical];
    if (vm) w.vertical = vm;
  }
  return w;
}

function applyUserFilter(
  w: Prisma.UserEventWhereInput,
  allowed: Set<string> | null,
): Prisma.UserEventWhereInput {
  if (!allowed) return w;
  if (allowed.size === 0) {
    return { ...w, userId: { in: [] } };
  }
  return {
    ...w,
    userId: { in: [...allowed] },
  };
}

/** SQL-фрагмент AND … для сырых запросов (дублирует buildBaseEventWhere + user filter). */
function eventWhereSql(
  start: Date,
  end: Date,
  filters: AnalyticsOverviewFilters,
  cityId: string | null,
  allowed: Set<string> | null,
  exclusion: InternalTrafficExclusion,
): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`e."createdAt" >= ${start}`,
    Prisma.sql`e."createdAt" <= ${end}`,
    internalTrafficExclusionSql(exclusion, "e"),
  ];
  if (cityId) parts.push(Prisma.sql`e."cityId" = ${cityId}`);
  if (filters.entity && filters.entity !== "all") {
    const et = entityMap()[filters.entity];
    if (et) parts.push(Prisma.sql`e."entityType" = ${et}::"AnalyticsEntityType"`);
  }
  if (filters.vertical && filters.vertical !== "all") {
    const v = verticalMap()[filters.vertical];
    if (v) parts.push(Prisma.sql`e."vertical" = ${v}::"AnalyticsVertical"`);
  }
  if (allowed) {
    if (allowed.size === 0) return Prisma.sql`FALSE`;
    const ids = [...allowed];
    parts.push(Prisma.sql`e."userId" IN (${Prisma.join(ids)})`);
  }
  if (parts.length === 0) return Prisma.sql`TRUE`;
  let acc = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    acc = Prisma.sql`${acc} AND ${parts[i]!}`;
  }
  return acc;
}

async function loadEntityTitles(
  items: Array<{ entityType: string; entityId: string }>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const eventIds = items
    .filter((i) => i.entityType === "EVENT")
    .map((i) => i.entityId);
  const placeIds = items
    .filter((i) => i.entityType === "PLACE")
    .map((i) => i.entityId);
  const [acts, places] = await Promise.all([
    eventIds.length
      ? prisma.activity.findMany({
          where: { id: { in: eventIds } },
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
  for (const a of acts) map.set(`EVENT:${a.id}`, a.title);
  for (const p of places) map.set(`PLACE:${p.id}`, p.title);
  return map;
}

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
  morning: "Утро (6–12)",
  day: "День (12–18)",
  evening: "Вечер (18–22)",
  night: "Ночь (22–6)",
};

/** Бакеты времени суток и дни недели — по Минску (B2). */
const TIMEZONE_NOTE = "Время суток и дни недели — по Минску.";

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
  const { start, end, cityId, exclusion } = await loadAnalyticsScope(filters);
  const allowed = await resolveAllowedUserIds(filters);

  if (allowed && allowed.size === 0) {
    return emptyBehaviorResult(start, end);
  }

  const baseWhere = buildBaseEventWhere(start, end, filters, cityId, exclusion);
  const where = applyUserFilter(baseWhere, allowed);
  const wsql = eventWhereSql(start, end, filters, cityId, allowed, exclusion);

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
      ageBandStats(wsql),
      signalsFormatFromUsers(userIds, "signals"),
      categoryFromEvents(wsql),
      signalsFormatFromUsers(userIds, "formats"),
    ]);

  const interactionGaps = await buildInteractionGaps(gapAgg);
  const vertMetrics = await verticalMetrics(where);

  const nextDayShare =
    planAddsTotal > 0 ? planAddsNextDay / planAddsTotal : null;

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    timezoneNote: TIMEZONE_NOTE,
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
          WHEN EXTRACT(HOUR FROM (e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${MINSK_TZ}) BETWEEN 6 AND 11 THEN 'morning'
          WHEN EXTRACT(HOUR FROM (e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${MINSK_TZ}) BETWEEN 12 AND 17 THEN 'day'
          WHEN EXTRACT(HOUR FROM (e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${MINSK_TZ}) BETWEEN 18 AND 21 THEN 'evening'
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
      EXTRACT(ISODOW FROM (e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${MINSK_TZ})::int AS dow,
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

type PlanningProfileAverages = {
  avgSame: number | null;
  avgAdvance: number | null;
  avgWeekend: number | null;
};

/**
 * Average planning-timing shares over the profiles of users with events in the
 * filter. null (not 0, not NaN) when there is nobody to average over — a user
 * without a UserBehaviorProfile row (or an empty window) means "no data".
 */
export function averagePlanningProfiles(
  profiles: ReadonlyArray<{ sameDayPlanningShare: number; advancePlanningShare: number; weekendShare: number }>,
): PlanningProfileAverages {
  const n = profiles.length;
  if (n === 0) return { avgSame: null, avgAdvance: null, avgWeekend: null };
  return {
    avgSame: profiles.reduce((a, p) => a + p.sameDayPlanningShare, 0) / n,
    avgAdvance: profiles.reduce((a, p) => a + p.advancePlanningShare, 0) / n,
    avgWeekend: profiles.reduce((a, p) => a + p.weekendShare, 0) / n,
  };
}

async function planningProfileStats(where: Prisma.UserEventWhereInput): Promise<PlanningProfileAverages> {
  const distinct = await prisma.userEvent.findMany({
    where: { ...where, userId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const ids = distinct.map((d) => d.userId!);
  if (ids.length === 0) return averagePlanningProfiles([]);
  const profiles = await prisma.userBehaviorProfile.findMany({
    where: { userId: { in: ids } },
    select: {
      sameDayPlanningShare: true,
      advancePlanningShare: true,
      weekendShare: true,
    },
  });
  return averagePlanningProfiles(profiles);
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
  const raw = await prisma.$queryRaw<GapRow[]>`
    SELECT
      e."entityType"::text AS "entityType",
      e."entityId"::text AS "entityId",
      SUM(CASE WHEN e."eventType" = 'DETAIL_OPEN' THEN 1 ELSE 0 END)::bigint AS opens,
      SUM(CASE WHEN e."eventType" = 'SAVE' THEN 1 ELSE 0 END)::bigint AS saves,
      SUM(CASE WHEN e."eventType" = 'PLAN_ADD' THEN 1 ELSE 0 END)::bigint AS plans,
      SUM(CASE WHEN e."eventType" = 'CTA_CLICK' THEN 1 ELSE 0 END)::bigint AS ctas
    FROM "UserEvent" e
    WHERE ${wsql}
      AND e."entityId" IS NOT NULL
      AND e."entityType" IS NOT NULL
    GROUP BY e."entityType", e."entityId"
  `;
  return raw;
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
  const titles = await loadEntityTitles(allKeys);

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

/**
 * Views / saves / plan-adds by the youngest child's age band. The event table
 * is aggregated IN SQL to one row per user (D5) — never loaded event-by-event
 * into memory — and only the per-user counters are folded into bands.
 */
async function ageBandStats(wsql: Prisma.Sql): Promise<AnalyticsBehaviorResult["ageBreakdown"]> {
  const bandMap = await youngestChildBandByUser();
  const perUser = await prisma.$queryRaw<Array<{ userId: string; views: bigint; saves: bigint; planAdds: bigint }>>`
    SELECT e."userId" AS "userId",
      COUNT(*) FILTER (WHERE e."eventType" = ${PAGE_VIEW_EVENT}::"UserEventType")::bigint AS views,
      COUNT(*) FILTER (WHERE e."eventType" = 'SAVE')::bigint AS saves,
      COUNT(*) FILTER (WHERE e."eventType" = 'PLAN_ADD')::bigint AS "planAdds"
    FROM "UserEvent" e
    WHERE ${wsql} AND e."userId" IS NOT NULL
    GROUP BY e."userId"
  `;
  const acc: Record<string, { views: number; saves: number; planAdds: number }> = {
    "0-3": { views: 0, saves: 0, planAdds: 0 },
    "3-6": { views: 0, saves: 0, planAdds: 0 },
    "6-10": { views: 0, saves: 0, planAdds: 0 },
    "10+": { views: 0, saves: 0, planAdds: 0 },
    unknown: { views: 0, saves: 0, planAdds: 0 },
  };
  for (const row of perUser) {
    const b = acc[bandMap.get(row.userId) ?? "unknown"] ?? acc.unknown!;
    b.views += Number(row.views);
    b.saves += Number(row.saves);
    b.planAdds += Number(row.planAdds);
  }
  return (["0-3", "3-6", "6-10", "10+", "unknown"] as const).map((band) => ({
    band,
    views: acc[band]?.views ?? 0,
    saves: acc[band]?.saves ?? 0,
    planAdds: acc[band]?.planAdds ?? 0,
  }));
}

/**
 * Real events by the category of the event card (D4): feed impressions,
 * saves, plan-adds and CTA clicks inside the selected period, grouped by
 * `Activity.eventCategoryId`. Replaces the old "profile preference weight x
 * lifetime totals" estimate, which did not depend on the period at all.
 * Only EVENT entities carry a category; places/offers are not in this block.
 */
async function categoryFromEvents(wsql: Prisma.Sql): Promise<BehaviorNamedBreakdown[]> {
  const rows = await prisma.$queryRaw<
    Array<{ key: string; label: string; views: bigint; saves: bigint; planAdds: bigint; ctas: bigint }>
  >`
    SELECT c.id AS key, c."nameRu" AS label,
      COUNT(*) FILTER (WHERE e."eventType" = ${FEED_IMPRESSION_EVENT}::"UserEventType")::bigint AS views,
      COUNT(*) FILTER (WHERE e."eventType" = 'SAVE')::bigint AS saves,
      COUNT(*) FILTER (WHERE e."eventType" = 'PLAN_ADD')::bigint AS "planAdds",
      COUNT(*) FILTER (WHERE e."eventType" = 'CTA_CLICK')::bigint AS ctas
    FROM "UserEvent" e
    JOIN "Activity" a ON a.id = e."entityId"
    JOIN "EventCategory" c ON c.id = a."eventCategoryId"
    WHERE ${wsql}
      AND e."entityType" = 'EVENT'
      AND e."eventType" IN (${FEED_IMPRESSION_EVENT}::"UserEventType", 'SAVE', 'PLAN_ADD', 'CTA_CLICK')
    GROUP BY c.id, c."nameRu"
    ORDER BY views DESC, saves DESC, c."nameRu" ASC
    LIMIT 10
  `;
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    views: Number(r.views),
    saves: Number(r.saves),
    planAdds: Number(r.planAdds),
    ctaClicks: Number(r.ctas),
  }));
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
  where: Prisma.UserEventWhereInput,
): Promise<BehaviorNamedBreakdown[]> {
  // Per-vertical "views" are feed impressions (CARD_VIEW): PAGE_VIEW carries no vertical.
  const types: UserEventType[] = [
    FEED_IMPRESSION_EVENT,
    "SAVE",
    "PLAN_ADD",
    "CTA_CLICK",
  ];
  const rows = await prisma.userEvent.groupBy({
    by: ["vertical", "eventType"],
    where: {
      ...where,
      vertical: { not: null },
      eventType: { in: types },
    },
    _count: { _all: true },
  });
  const byVert: Record<
    string,
    { views: number; saves: number; planAdds: number; cta: number }
  > = {};
  for (const r of rows) {
    const v = r.vertical ?? "";
    if (!byVert[v])
      byVert[v] = { views: 0, saves: 0, planAdds: 0, cta: 0 };
    const c = r._count._all;
    if (r.eventType === FEED_IMPRESSION_EVENT) byVert[v].views += c;
    if (r.eventType === "SAVE") byVert[v].saves += c;
    if (r.eventType === "PLAN_ADD") byVert[v].planAdds += c;
    if (r.eventType === "CTA_CLICK") byVert[v].cta += c;
  }
  return Object.entries(byVert)
    .map(([key, m]) => ({
      key,
      label: key,
      views: m.views,
      saves: m.saves,
      planAdds: m.planAdds,
      ctaClicks: m.cta,
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
    timezoneNote: TIMEZONE_NOTE,
    activityByTime: ORDERED_BUCKETS.map(z),
    activityByDay: DOW_LABELS.map((label, i) => ({
      isoDow: i + 1,
      label,
      events: 0,
      sessions: 0,
      activeUsers: 0,
    })),
    planning: {
      sameDayShare: null,
      nextDayShare: null,
      advanceShare: null,
      weekendShare: null,
    },
    interactionGaps: { openNoSave: [], saveNoPlan: [], planNoClick: [] },
    ageBreakdown: [],
    signalsBreakdown: [],
    categoryBreakdown: [],
    formatBreakdown: [],
    verticalBreakdown: [],
  };
}
