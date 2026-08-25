import {
  Prisma,
  type AnalyticsEntityType,
  type AnalyticsVertical,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";

export function analyticsEntityMap(): Record<string, AnalyticsEntityType> {
  return {
    event: "EVENT",
    place: "PLACE",
    offer: "OFFER",
    route: "ROUTE",
    article: "ARTICLE",
  };
}

export function analyticsVerticalMap(): Record<string, AnalyticsVertical> {
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

/**
 * Shared youngest-child age-band resolver for analytics filters/breakdowns.
 * Keeping one implementation prevents segment/age filter drift between tabs.
 */
export async function youngestChildBandByUser(): Promise<Map<string, string>> {
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

/** Пользователи с ключом сегмента в профиле поведения (для аналитики / воронок). */
export async function getUserIdsInSegment(segmentKey: string): Promise<Set<string>> {
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

export async function resolveAnalyticsAllowedUserIds(
  filters: AnalyticsOverviewFilters,
): Promise<Set<string> | null> {
  let seg: Set<string> | null = null;
  let age: Set<string> | null = null;

  if (filters.segment?.trim()) {
    seg = await getUserIdsInSegment(filters.segment.trim());
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

export function buildAnalyticsBaseEventWhere(
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
    const em = analyticsEntityMap()[filters.entity];
    if (em) w.entityType = em;
  }
  if (filters.vertical && filters.vertical !== "all") {
    const vm = analyticsVerticalMap()[filters.vertical];
    if (vm) w.vertical = vm;
  }
  return w;
}

export function applyAnalyticsUserFilter(
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

export function analyticsEventWhereSql(
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
    const et = analyticsEntityMap()[filters.entity];
    if (et) parts.push(Prisma.sql`e."entityType" = ${et}::"AnalyticsEntityType"`);
  }
  if (filters.vertical && filters.vertical !== "all") {
    const v = analyticsVerticalMap()[filters.vertical];
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

/** Заголовки EVENT / PLACE / OFFER / ROUTE / ARTICLE. */
export async function loadAllEntityTitles(
  items: Array<{ entityType: string; entityId: string }>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const by = (t: string) =>
    items.filter((i) => i.entityType === t).map((i) => i.entityId);
  const eventIds = by("EVENT");
  const placeIds = by("PLACE");
  const offerIds = by("OFFER");
  const routeIds = by("ROUTE");
  const articleIds = by("ARTICLE");

  const [acts, places, offers, routes, articles] = await Promise.all([
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
    offerIds.length
      ? prisma.offer.findMany({
          where: { id: { in: offerIds } },
          select: { id: true, title: true },
        })
      : [],
    routeIds.length
      ? prisma.route.findMany({
          where: { id: { in: routeIds } },
          select: { id: true, title: true },
        })
      : [],
    articleIds.length
      ? prisma.article.findMany({
          where: { id: { in: articleIds } },
          select: { id: true, title: true },
        })
      : [],
  ]);
  for (const a of acts) map.set(`EVENT:${a.id}`, a.title);
  for (const p of places) map.set(`PLACE:${p.id}`, p.title);
  for (const o of offers) map.set(`OFFER:${o.id}`, o.title);
  for (const r of routes) map.set(`ROUTE:${r.id}`, r.title);
  for (const a of articles) map.set(`ARTICLE:${a.id}`, a.title);
  return map;
}
