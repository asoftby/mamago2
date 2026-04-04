import { Prisma, type UserEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import type {
  AnalyticsContentPerformanceResult,
  ContentPerformanceComparisonRow,
  ContentPerformanceConverterRow,
  ContentPerformanceEntityRow,
  ContentPerformanceTopItem,
} from "@/lib/analytics/analyticsContentPerformanceTypes";
import {
  analyticsEventWhereSql,
  applyAnalyticsUserFilter,
  buildAnalyticsBaseEventWhere,
  loadAllEntityTitles,
  resolveAnalyticsAllowedUserIds,
} from "@/server/services/analytics/analyticsQueryHelpers";
import {
  resolveAnalyticsDateRange,
  resolveCityIdFromSlug,
} from "@/server/services/analytics/analyticsDateRange";

const VIEW_TYPES: UserEventType[] = ["PAGE_VIEW", "CARD_VIEW"];

type AggRow = {
  entity_type: string;
  entity_id: string;
  views: bigint;
  opens: bigint;
  saves: bigint;
  plan_adds: bigint;
  cta_clicks: bigint;
};

type MetaRow = {
  entityType: string;
  entityId: string;
  vertical: string | null;
  cityId: string | null;
};

function toNum(b: bigint | undefined): number {
  return Number(b ?? BigInt(0));
}

function rowToEntity(
  r: AggRow,
  meta: Map<string, MetaRow>,
  titles: Map<string, string>,
  cityNames: Map<string, string>,
): ContentPerformanceEntityRow {
  const key = `${r.entity_type}:${r.entity_id}`;
  const m = meta.get(key);
  const views = toNum(r.views);
  const opens = toNum(r.opens);
  const saves = toNum(r.saves);
  const planAdds = toNum(r.plan_adds);
  const cta = toNum(r.cta_clicks);
  const openRate = views > 0 ? opens / views : 0;
  const saveRate = opens > 0 ? saves / opens : 0;
  const planRate = saves > 0 ? planAdds / saves : 0;
  const clickRateVsOpens = opens > 0 ? cta / opens : 0;
  const clickRateVsPlans = planAdds > 0 ? cta / planAdds : 0;
  const cityId = m?.cityId ?? null;
  return {
    entityType: r.entity_type,
    entityId: r.entity_id,
    title:
      titles.get(key) ??
      `${r.entity_type} ${r.entity_id.slice(0, 8)}…`,
    vertical: m?.vertical ?? null,
    cityId,
    cityName: cityId ? cityNames.get(cityId) ?? null : null,
    views,
    opens,
    saves,
    planAdds,
    ctaClicks: cta,
    openRate,
    saveRate,
    planRate,
    clickRateVsOpens,
    clickRateVsPlans,
  };
}

function toTopItem(r: ContentPerformanceEntityRow, primary: number): ContentPerformanceTopItem {
  return {
    entityType: r.entityType,
    entityId: r.entityId,
    title: r.title,
    vertical: r.vertical,
    cityName: r.cityName,
    primaryMetric: primary,
    views: r.views,
    opens: r.opens,
    saves: r.saves,
    planAdds: r.planAdds,
    ctaClicks: r.ctaClicks,
  };
}

function sortRows(
  rows: ContentPerformanceEntityRow[],
  sortKey: string,
  sortDir: "asc" | "desc",
): ContentPerformanceEntityRow[] {
  const mult = sortDir === "asc" ? 1 : -1;
  const keys = new Set([
    "views",
    "opens",
    "saves",
    "planAdds",
    "ctaClicks",
    "openRate",
    "saveRate",
    "planRate",
    "clickRateVsOpens",
    "clickRateVsPlans",
    "title",
  ]);
  const k = keys.has(sortKey) ? sortKey : "views";
  return [...rows].sort((a, b) => {
    if (k === "title") {
      return mult * a.title.localeCompare(b.title, "en");
    }
    const va = a[k as keyof ContentPerformanceEntityRow] as number;
    const vb = b[k as keyof ContentPerformanceEntityRow] as number;
    return mult * (va - vb);
  });
}

export async function getAnalyticsContentPerformance(
  filters: AnalyticsOverviewFilters,
  opts: {
    page?: number;
    pageSize?: number;
    sortKey?: string;
    sortDir?: "asc" | "desc";
  } = {},
): Promise<AnalyticsContentPerformanceResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, opts.pageSize ?? 25));
  const sortKey = opts.sortKey ?? "views";
  const sortDir = opts.sortDir ?? "desc";

  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const allowed = await resolveAnalyticsAllowedUserIds(filters);

  if (allowed && allowed.size === 0) {
    return emptyResult(start, end, page, pageSize, sortKey, sortDir);
  }

  const baseWhere = buildAnalyticsBaseEventWhere(start, end, filters, cityId);
  const where = applyAnalyticsUserFilter(baseWhere, allowed);
  const wsql = analyticsEventWhereSql(start, end, filters, cityId, allowed);

  const [aggRows, metaRows] = await Promise.all([
    prisma.$queryRaw<AggRow[]>`
      SELECT
        e."entityType"::text AS entity_type,
        e."entityId"::text AS entity_id,
        SUM(CASE WHEN e."eventType" IN ('PAGE_VIEW','CARD_VIEW') THEN 1 ELSE 0 END)::bigint AS views,
        SUM(CASE WHEN e."eventType" = 'DETAIL_OPEN' THEN 1 ELSE 0 END)::bigint AS opens,
        SUM(CASE WHEN e."eventType" = 'SAVE' THEN 1 ELSE 0 END)::bigint AS saves,
        SUM(CASE WHEN e."eventType" = 'PLAN_ADD' THEN 1 ELSE 0 END)::bigint AS plan_adds,
        SUM(CASE WHEN e."eventType" = 'CTA_CLICK' THEN 1 ELSE 0 END)::bigint AS cta_clicks
      FROM "UserEvent" e
      WHERE ${wsql}
        AND e."entityId" IS NOT NULL
        AND e."entityType" IS NOT NULL
      GROUP BY e."entityType", e."entityId"
      HAVING
        SUM(CASE WHEN e."eventType" IN ('PAGE_VIEW','CARD_VIEW') THEN 1 ELSE 0 END)
        + SUM(CASE WHEN e."eventType" = 'DETAIL_OPEN' THEN 1 ELSE 0 END) > 0
      ORDER BY SUM(CASE WHEN e."eventType" IN ('PAGE_VIEW','CARD_VIEW') THEN 1 ELSE 0 END) DESC
      LIMIT 400
    `,
    prisma.$queryRaw<MetaRow[]>`
      SELECT DISTINCT ON (e."entityType", e."entityId")
        e."entityType"::text AS "entityType",
        e."entityId"::text AS "entityId",
        e."vertical"::text AS vertical,
        e."cityId"
      FROM "UserEvent" e
      WHERE ${wsql}
        AND e."entityId" IS NOT NULL
        AND e."entityType" IS NOT NULL
      ORDER BY e."entityType", e."entityId", e."createdAt" DESC
    `,
  ]);

  const metaMap = new Map(
    metaRows.map((m) => [`${m.entityType}:${m.entityId}`, m]),
  );

  const keys = aggRows.map((r) => ({
    entityType: r.entity_type,
    entityId: r.entity_id,
  }));
  const titles = await loadAllEntityTitles(keys);
  const cityIds = [
    ...new Set(
      metaRows.map((m) => m.cityId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const cities =
    cityIds.length > 0
      ? await prisma.city.findMany({
          where: { id: { in: cityIds } },
          select: { id: true, name: true },
        })
      : [];
  const cityNames = new Map(cities.map((c) => [c.id, c.name]));

  const allRows: ContentPerformanceEntityRow[] = aggRows.map((r) =>
    rowToEntity(r, metaMap, titles, cityNames),
  );

  const sorted = sortRows(allRows, sortKey, sortDir);
  const performanceTotal = sorted.length;
  const startIdx = (page - 1) * pageSize;
  const performanceTable = sorted.slice(startIdx, startIdx + pageSize);

  const topViews = [...allRows]
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)
    .map((r) => toTopItem(r, r.views));
  const topOpens = [...allRows]
    .sort((a, b) => b.opens - a.opens)
    .slice(0, 8)
    .map((r) => toTopItem(r, r.opens));
  const topSaves = [...allRows]
    .sort((a, b) => b.saves - a.saves)
    .slice(0, 8)
    .map((r) => toTopItem(r, r.saves));
  const topPlanAdds = [...allRows]
    .sort((a, b) => b.planAdds - a.planAdds)
    .slice(0, 8)
    .map((r) => toTopItem(r, r.planAdds));
  const topClicks = [...allRows]
    .sort((a, b) => b.ctaClicks - a.ctaClicks)
    .slice(0, 8)
    .map((r) => toTopItem(r, r.ctaClicks));

  const bestConverters = {
    bySaveRate: pickBest(
      allRows.filter((r) => r.views >= 10 && r.opens >= 3),
      (r) => r.saveRate,
      8,
    ),
    byPlanRate: pickBest(
      allRows.filter((r) => r.saves >= 3),
      (r) => r.planRate,
      8,
    ),
    byClickRate: pickBest(
      allRows.filter((r) => r.opens >= 5),
      (r) => r.clickRateVsOpens,
      8,
    ),
  };

  const worstConverters = [...allRows]
    .filter((r) => r.views >= 35 && r.saveRate < 0.12 && r.opens >= 5)
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  const entityTypeComparison = buildEntityTypeComparison(allRows);
  const verticalComparison = await buildVerticalComparison(where);

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    topViews,
    topOpens,
    topSaves,
    topPlanAdds,
    topClicks,
    performanceTable,
    performanceTotal,
    page,
    pageSize,
    sortKey,
    sortDir,
    bestConverters,
    worstConverters,
    entityTypeComparison,
    verticalComparison,
  };
}

function pickBest(
  rows: ContentPerformanceEntityRow[],
  score: (r: ContentPerformanceEntityRow) => number,
  take: number,
): ContentPerformanceConverterRow[] {
  return [...rows]
    .sort((a, b) => score(b) - score(a))
    .slice(0, take)
    .map((r) => ({ ...r }));
}

function buildEntityTypeComparison(
  rows: ContentPerformanceEntityRow[],
): ContentPerformanceComparisonRow[] {
  const by: Record<
    string,
    { views: number; opens: number; saves: number; planAdds: number; cta: number }
  > = {};
  for (const r of rows) {
    if (!by[r.entityType])
      by[r.entityType] = {
        views: 0,
        opens: 0,
        saves: 0,
        planAdds: 0,
        cta: 0,
      };
    const x = by[r.entityType]!;
    x.views += r.views;
    x.opens += r.opens;
    x.saves += r.saves;
    x.planAdds += r.planAdds;
    x.cta += r.ctaClicks;
  }
  return Object.entries(by)
    .map(([key, m]) => {
      const saveRate = m.opens > 0 ? m.saves / m.opens : 0;
      const planRate = m.saves > 0 ? m.planAdds / m.saves : 0;
      const clickRateVsOpens = m.opens > 0 ? m.cta / m.opens : 0;
      return {
        key,
        label: key,
        views: m.views,
        opens: m.opens,
        saves: m.saves,
        planAdds: m.planAdds,
        ctaClicks: m.cta,
        saveRate,
        planRate,
        clickRateVsOpens,
      };
    })
    .sort((a, b) => b.views - a.views);
}

async function buildVerticalComparison(
  where: Prisma.UserEventWhereInput,
): Promise<ContentPerformanceComparisonRow[]> {
  const types: UserEventType[] = [
    ...VIEW_TYPES,
    "DETAIL_OPEN",
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
    { views: number; opens: number; saves: number; planAdds: number; cta: number }
  > = {};
  for (const r of rows) {
    const v = r.vertical ?? "";
    if (!byVert[v])
      byVert[v] = { views: 0, opens: 0, saves: 0, planAdds: 0, cta: 0 };
    const c = r._count._all;
    if (r.eventType === "PAGE_VIEW" || r.eventType === "CARD_VIEW")
      byVert[v].views += c;
    if (r.eventType === "DETAIL_OPEN") byVert[v].opens += c;
    if (r.eventType === "SAVE") byVert[v].saves += c;
    if (r.eventType === "PLAN_ADD") byVert[v].planAdds += c;
    if (r.eventType === "CTA_CLICK") byVert[v].cta += c;
  }
  return Object.entries(byVert)
    .map(([key, m]) => ({
      key,
      label: key,
      views: m.views,
      opens: m.opens,
      saves: m.saves,
      planAdds: m.planAdds,
      ctaClicks: m.cta,
      saveRate: m.opens > 0 ? m.saves / m.opens : 0,
      planRate: m.saves > 0 ? m.planAdds / m.saves : 0,
      clickRateVsOpens: m.opens > 0 ? m.cta / m.opens : 0,
    }))
    .sort((a, b) => b.views - a.views);
}

function emptyResult(
  start: Date,
  end: Date,
  page: number,
  pageSize: number,
  sortKey: string,
  sortDir: "asc" | "desc",
): AnalyticsContentPerformanceResult {
  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    topViews: [],
    topOpens: [],
    topSaves: [],
    topPlanAdds: [],
    topClicks: [],
    performanceTable: [],
    performanceTotal: 0,
    page,
    pageSize,
    sortKey,
    sortDir,
    bestConverters: {
      bySaveRate: [],
      byPlanRate: [],
      byClickRate: [],
    },
    worstConverters: [],
    entityTypeComparison: [],
    verticalComparison: [],
  };
}
