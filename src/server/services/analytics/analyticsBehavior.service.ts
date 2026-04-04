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
import {
  resolveAnalyticsDateRange,
  resolveCityIdFromSlug,
} from "@/server/services/analytics/analyticsDateRange";

const VIEW_TYPES: UserEventType[] = ["PAGE_VIEW", "CARD_VIEW"];

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
  const rows = await prisma.$queryRaw<Array<{ parentId: string; youngest: Date }>>`
    SELECT c."parentId", MAX(c."birthDate") AS youngest
    FROM "Child" c
    WHERE c."birthDate" IS NOT NULL
    GROUP BY c."parentId"
  `;
  const map = new Map<string, string>();
  for (const r of rows) {
    const age = ageYearsFromBirth(r.youngest);
    map.set(r.parentId, bandFromAgeYears(age));
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
): Prisma.UserEventWhereInput {
  const w: Prisma.UserEventWhereInput = {
    createdAt: { gte: start, lte: end },
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
): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`e."createdAt" >= ${start}`,
    Prisma.sql`e."createdAt" <= ${end}`,
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
  const allowed = await resolveAllowedUserIds(filters);

  if (allowed && allowed.size === 0) {
    return emptyBehaviorResult(start, end);
  }

  const baseWhere = buildBaseEventWhere(start, end, filters, cityId);
  const where = applyUserFilter(baseWhere, allowed);
  const wsql = eventWhereSql(start, end, filters, cityId, allowed);

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
    entityFunnelAggregates(where),
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
  const vertMetrics = await verticalMetrics(where);

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

async function entityFunnelAggregates(
  where: Prisma.UserEventWhereInput,
): Promise<GapRow[]> {
  const raw = await prisma.$queryRaw<GapRow[]>`
    SELECT
      e."entityType"::text AS "entityType",
      e."entityId"::text AS "entityId",
      SUM(CASE WHEN e."eventType" = 'DETAIL_OPEN' THEN 1 ELSE 0 END)::bigint AS opens,
      SUM(CASE WHEN e."eventType" = 'SAVE' THEN 1 ELSE 0 END)::bigint AS saves,
      SUM(CASE WHEN e."eventType" = 'PLAN_ADD' THEN 1 ELSE 0 END)::bigint AS plans,
      SUM(CASE WHEN e."eventType" = 'CTA_CLICK' THEN 1 ELSE 0 END)::bigint AS ctas
    FROM "UserEvent" e
    WHERE ${eventWhereSqlFromPrismaWhere(where)}
      AND e."entityId" IS NOT NULL
      AND e."entityType" IS NOT NULL
    GROUP BY e."entityType", e."entityId"
  `;
  return raw;
}

/** Только для raw: восстанавливает условия из объекта where (ограниченный набор полей). */
function eventWhereSqlFromPrismaWhere(where: Prisma.UserEventWhereInput): Prisma.Sql {
  const w = where as Record<string, unknown>;
  const parts: Prisma.Sql[] = [];
  const ca = w.createdAt as { gte?: Date; lte?: Date } | undefined;
  if (ca?.gte) parts.push(Prisma.sql`e."createdAt" >= ${ca.gte}`);
  if (ca?.lte) parts.push(Prisma.sql`e."createdAt" <= ${ca.lte}`);
  if (w.cityId) parts.push(Prisma.sql`e."cityId" = ${w.cityId as string}`);
  if (w.entityType) parts.push(Prisma.sql`e."entityType" = ${w.entityType}::"AnalyticsEntityType"`);
  if (w.vertical) parts.push(Prisma.sql`e."vertical" = ${w.vertical}::"AnalyticsVertical"`);
  if (w.userId && typeof w.userId === "object" && "in" in (w.userId as object)) {
    const inp = w.userId as { in: string[] };
    if (inp.in.length === 0) return Prisma.sql`FALSE`;
    parts.push(Prisma.sql`e."userId" IN (${Prisma.join(inp.in)})`);
  }
  if (parts.length === 0) return Prisma.sql`TRUE`;
  let acc = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    acc = Prisma.sql`${acc} AND ${parts[i]!}`;
  }
  return acc;
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

async function ageBandStats(
  where: Prisma.UserEventWhereInput,
): Promise<AnalyticsBehaviorResult["ageBreakdown"]> {
  const bandMap = await youngestChildBandByUser();
  const events = await prisma.userEvent.findMany({
    where: { ...where, userId: { not: null } },
    select: { userId: true, eventType: true },
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
    if (e.eventType === "PAGE_VIEW" || e.eventType === "CARD_VIEW") b.views += 1;
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
  const catMap: Record<string, { v: number; s: number; p: number }> = {};
  for (const p of profiles) {
    const raw = p.preferredCategories;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
      if (k === "_none") continue;
      const weight = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(weight) || weight <= 0) continue;
      if (!catMap[k]) catMap[k] = { v: 0, s: 0, p: 0 };
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
  where: Prisma.UserEventWhereInput,
): Promise<BehaviorNamedBreakdown[]> {
  const types: UserEventType[] = [
    ...VIEW_TYPES,
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
    if (r.eventType === "PAGE_VIEW" || r.eventType === "CARD_VIEW")
      byVert[v].views += c;
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
