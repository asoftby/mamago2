import { Prisma, type AnalyticsEntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import type {
  AnalyticsContentPerformanceResult,
  ContentPerformanceComparisonRow,
  ContentPerformanceConverterRow,
  ContentPerformanceEntityRow,
  ContentPerformanceTopItem,
  PublicationAnalyticsDetail,
  PublicationCtaBreakdownRow,
} from "@/lib/analytics/analyticsContentPerformanceTypes";
import {
  analyticsEventWhereSql,
  loadAllEntityTitles,
  resolveAnalyticsAllowedUserIds,
} from "@/server/services/analytics/analyticsQueryHelpers";
import {
  resolveAnalyticsDateRange,
  resolveCityIdFromSlug,
} from "@/server/services/analytics/analyticsDateRange";
import { labelForCtaTargetAction } from "@/lib/analytics/ctaTargetActionLabels";

/** Contract v1: a content impression is a real content CARD_VIEW, not an inner article CTA impression. */
const CANONICAL_CARD_IMPRESSION_SQL = Prisma.sql`
  e."eventType" = 'CARD_VIEW'
  AND COALESCE(e."meta"->>'articleEvent', '') <> 'article_telegram_cta_impression'
`;

/** Contract v1: reading/rating transport events do not belong to the conversion CTA KPI. */
const CANONICAL_CTA_CLICK_SQL = Prisma.sql`
  e."eventType" = 'CTA_CLICK'
  AND COALESCE(e."meta"->>'articleEvent', '') NOT IN (
    'article_read_25',
    'article_read_50',
    'article_read_75',
    'article_complete',
    'next_article_loaded',
    'article_section_exhausted',
    'article_rating_submitted'
  )
`;

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

type VerticalAggRow = {
  vertical: string;
  views: bigint;
  opens: bigint;
  saves: bigint;
  plan_adds: bigint;
  cta_clicks: bigint;
};

type PublicationMetricRow = {
  impressions: bigint;
  opens: bigint;
  saves: bigint;
  plan_adds: bigint;
  cta_clicks: bigint;
};

function toNum(b: bigint | null | undefined): number {
  return Number(b ?? BigInt(0));
}

/** null when the denominator is 0 — never render a fake 0% for an unmeasured rate. */
function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
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
  const openRate = rate(opens, views);
  const saveRate = rate(saves, opens);
  const planRate = rate(planAdds, saves);
  const clickRateVsOpens = rate(cta, opens);
  const clickRateVsPlans = rate(cta, planAdds);
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
    // null (unmeasured rate) sorts as lowest, never as if it were a real 0.
    const va = (a[k as keyof ContentPerformanceEntityRow] as number | null) ?? -1;
    const vb = (b[k as keyof ContentPerformanceEntityRow] as number | null) ?? -1;
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

  const wsql = analyticsEventWhereSql(start, end, filters, cityId, allowed);

  const [aggRows, metaRows] = await Promise.all([
    prisma.$queryRaw<AggRow[]>`
      SELECT
        e."entityType"::text AS entity_type,
        e."entityId"::text AS entity_id,
        SUM(CASE WHEN ${CANONICAL_CARD_IMPRESSION_SQL} THEN 1 ELSE 0 END)::bigint AS views,
        SUM(CASE WHEN e."eventType" = 'DETAIL_OPEN' THEN 1 ELSE 0 END)::bigint AS opens,
        SUM(CASE WHEN e."eventType" = 'SAVE' THEN 1 ELSE 0 END)::bigint AS saves,
        SUM(CASE WHEN e."eventType" = 'PLAN_ADD' THEN 1 ELSE 0 END)::bigint AS plan_adds,
        SUM(CASE WHEN ${CANONICAL_CTA_CLICK_SQL} THEN 1 ELSE 0 END)::bigint AS cta_clicks
      FROM "UserEvent" e
      WHERE ${wsql}
        AND e."entityId" IS NOT NULL
        AND e."entityType" IS NOT NULL
      GROUP BY e."entityType", e."entityId"
      HAVING
        SUM(CASE WHEN ${CANONICAL_CARD_IMPRESSION_SQL} THEN 1 ELSE 0 END)
        + SUM(CASE WHEN e."eventType" = 'DETAIL_OPEN' THEN 1 ELSE 0 END) > 0
      ORDER BY SUM(CASE WHEN ${CANONICAL_CARD_IMPRESSION_SQL} THEN 1 ELSE 0 END) DESC
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
    .filter((r) => r.views >= 35 && r.opens >= 5 && r.saveRate != null && r.saveRate < 0.12)
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  const entityTypeComparison = buildEntityTypeComparison(allRows);
  const verticalComparison = await buildVerticalComparison(wsql);

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
  score: (r: ContentPerformanceEntityRow) => number | null,
  take: number,
): ContentPerformanceConverterRow[] {
  return [...rows]
    .sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1))
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
      const saveRate = rate(m.saves, m.opens);
      const planRate = rate(m.planAdds, m.saves);
      const clickRateVsOpens = rate(m.cta, m.opens);
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
  wsql: Prisma.Sql,
): Promise<ContentPerformanceComparisonRow[]> {
  const rows = await prisma.$queryRaw<VerticalAggRow[]>`
    SELECT
      e."vertical"::text AS vertical,
      SUM(CASE WHEN ${CANONICAL_CARD_IMPRESSION_SQL} THEN 1 ELSE 0 END)::bigint AS views,
      SUM(CASE WHEN e."eventType" = 'DETAIL_OPEN' THEN 1 ELSE 0 END)::bigint AS opens,
      SUM(CASE WHEN e."eventType" = 'SAVE' THEN 1 ELSE 0 END)::bigint AS saves,
      SUM(CASE WHEN e."eventType" = 'PLAN_ADD' THEN 1 ELSE 0 END)::bigint AS plan_adds,
      SUM(CASE WHEN ${CANONICAL_CTA_CLICK_SQL} THEN 1 ELSE 0 END)::bigint AS cta_clicks
    FROM "UserEvent" e
    WHERE ${wsql}
      AND e."vertical" IS NOT NULL
    GROUP BY e."vertical"
  `;

  return rows
    .map((r) => {
      const views = toNum(r.views);
      const opens = toNum(r.opens);
      const saves = toNum(r.saves);
      const planAdds = toNum(r.plan_adds);
      const ctaClicks = toNum(r.cta_clicks);
      return {
        key: r.vertical,
        label: r.vertical,
        views,
        opens,
        saves,
        planAdds,
        ctaClicks,
        saveRate: rate(saves, opens),
        planRate: rate(planAdds, saves),
        clickRateVsOpens: rate(ctaClicks, opens),
      };
    })
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

/**
 * Per-publication drill-down (Task 3 MVP follow-up). Bounded aggregate query
 * scoped to one entityType+entityId, reusing the same UserEvent pipeline —
 * not a new analytics system. Respects the caller's dateRange/city filter
 * (the same period selected in Content Performance), not segment/childAgeBand
 * (not meaningful when already looking at one specific publication).
 * Returns aggregate counts only — never individual UserEvent rows, no
 * userId/sessionId/IP/UA in the result shape.
 */
export async function getPublicationAnalyticsDetail(params: {
  entityType: AnalyticsEntityType;
  entityId: string;
  filters: Pick<AnalyticsOverviewFilters, "dateRange" | "city">;
}): Promise<PublicationAnalyticsDetail> {
  const { entityType, entityId } = params;
  const { start, end } = resolveAnalyticsDateRange(params.filters.dateRange);
  const cityId = await resolveCityIdFromSlug(params.filters.city);

  const baseWhere: Prisma.UserEventWhereInput = {
    entityType,
    entityId,
    createdAt: { gte: start, lte: end },
    ...(cityId ? { cityId } : {}),
  };

  const [metricRows, ctaRows, titles, latestEvent] = await Promise.all([
    prisma.$queryRaw<PublicationMetricRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE ${CANONICAL_CARD_IMPRESSION_SQL})::bigint AS impressions,
        COUNT(*) FILTER (WHERE e."eventType" = 'DETAIL_OPEN')::bigint AS opens,
        COUNT(*) FILTER (WHERE e."eventType" = 'SAVE')::bigint AS saves,
        COUNT(*) FILTER (WHERE e."eventType" = 'PLAN_ADD')::bigint AS plan_adds,
        COUNT(*) FILTER (WHERE ${CANONICAL_CTA_CLICK_SQL})::bigint AS cta_clicks
      FROM "UserEvent" e
      WHERE e."entityType" = ${entityType}::"AnalyticsEntityType"
        AND e."entityId" = ${entityId}
        AND e."createdAt" >= ${start}
        AND e."createdAt" <= ${end}
        ${cityId ? Prisma.sql`AND e."cityId" = ${cityId}` : Prisma.empty}
    `,
    prisma.$queryRaw<Array<{ action: string; cnt: bigint }>>`
      SELECT COALESCE(e."meta"->>'targetAction', '') AS action, COUNT(*)::bigint AS cnt
      FROM "UserEvent" e
      WHERE e."entityType" = ${entityType}::"AnalyticsEntityType"
        AND e."entityId" = ${entityId}
        AND ${CANONICAL_CTA_CLICK_SQL}
        AND e."createdAt" >= ${start}
        AND e."createdAt" <= ${end}
        ${cityId ? Prisma.sql`AND e."cityId" = ${cityId}` : Prisma.empty}
      GROUP BY action
      ORDER BY cnt DESC
    `,
    loadAllEntityTitles([{ entityType, entityId }]),
    prisma.userEvent.findFirst({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      select: { vertical: true, cityId: true },
    }),
  ]);

  const metrics = metricRows[0];
  const impressions = toNum(metrics?.impressions);
  const opens = toNum(metrics?.opens);
  const saves = toNum(metrics?.saves);
  const planAdds = toNum(metrics?.plan_adds);
  const ctaClicks = toNum(metrics?.cta_clicks);

  const cityName = latestEvent?.cityId
    ? ((await prisma.city.findUnique({
        where: { id: latestEvent.cityId },
        select: { name: true },
      }))?.name ?? null)
    : null;

  const ctaBreakdown: PublicationCtaBreakdownRow[] = ctaRows
    .map((r) => {
      const action = r.action ? r.action : null;
      return {
        action,
        label: labelForCtaTargetAction(action),
        count: toNum(r.cnt),
      };
    })
    .sort((a, b) => b.count - a.count);

  const key = `${entityType}:${entityId}`;
  const title = titles.get(key) ?? `${entityType} ${entityId.slice(0, 8)}…`;

  return {
    entityType,
    entityId,
    title,
    vertical: latestEvent?.vertical ?? null,
    cityName,
    range: { start: start.toISOString(), end: end.toISOString() },
    metrics: { impressions, opens, saves, planAdds, ctaClicks },
    rates: {
      openRate: rate(opens, impressions),
      saveRate: rate(saves, opens),
      planRate: rate(planAdds, saves),
      ctaRateVsOpens: rate(ctaClicks, opens),
    },
    ctaBreakdown,
  };
}
