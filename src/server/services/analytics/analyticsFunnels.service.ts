import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import type {
  AnalyticsFunnelComparisonPair,
  AnalyticsFunnelDropTransition,
  AnalyticsFunnelSeries,
  AnalyticsFunnelStepKey,
  AnalyticsFunnelVerticalDrop,
  AnalyticsFunnelWorstEntity,
  AnalyticsFunnelsResult,
} from "@/lib/analytics/analyticsFunnelsTypes";
import {
  analyticsEntityMap,
  analyticsEventWhereSql,
  analyticsVerticalMap,
  applyAnalyticsUserFilter,
  buildAnalyticsBaseEventWhere,
  getUserIdsInSegment,
  loadAllEntityTitles,
  resolveAnalyticsAllowedUserIds,
} from "@/server/services/analytics/analyticsQueryHelpers";
import {
  resolveAnalyticsDateRange,
  resolveCityIdFromSlug,
} from "@/server/services/analytics/analyticsDateRange";
import {
  CANONICAL_CARD_IMPRESSION_SQL,
  CANONICAL_CTA_CLICK_SQL,
  canonicalMetricRowToCounts,
  canonicalMetricSelectSql,
  type CanonicalMetricRow,
} from "@/server/services/analytics/analyticsMetricSql";

const STEP_ORDER: AnalyticsFunnelStepKey[] = [
  "view",
  "open",
  "save",
  "plan",
  "click",
];

/**
 * Contract v1 labels. These are first-party event volumes, not a sequential
 * unique-user/session funnel. GA4 will own acquisition/session funnels.
 */
const STEP_LABELS: Record<AnalyticsFunnelStepKey, string> = {
  view: "Impressions",
  open: "Detail opens",
  save: "Saves",
  plan: "Plan adds",
  click: "CTA clicks",
};

const FUNNEL_SEGMENT_KEYS = [
  "SAVER",
  "PLANNER",
  "WEEKEND_ORIENTED",
  "LAST_MINUTE",
  "NEW_USER",
  "ACTIVE_USER",
  "BROWSER",
  "ADVANCE_PLANNER",
] as const;

const ENTITY_SLUGS = [
  "event",
  "place",
  "offer",
  "route",
  "article",
] as const;

const VERTICAL_SLUGS = [
  "city",
  "travel",
  "birthday",
  "education",
  "weekend",
  "seasonal",
] as const;

type FunnelCounts = {
  view: number;
  open: number;
  save: number;
  plan: number;
  click: number;
};

type AggRow = {
  entity_type: string;
  entity_id: string;
  views: bigint;
  opens: bigint;
  saves: bigint;
  plan_adds: bigint;
  cta_clicks: bigint;
};

function intersectSets<T>(a: Set<T> | null, b: Set<T>): Set<T> | null {
  if (!a) return b;
  const out = new Set<T>();
  for (const x of a) {
    if (b.has(x)) out.add(x);
  }
  return out;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Count the five canonical first-party metric volumes for one filter scope. */
async function countFunnel(wsql: Prisma.Sql): Promise<FunnelCounts> {
  const metricSelect = canonicalMetricSelectSql();
  const rows = await prisma.$queryRaw<CanonicalMetricRow[]>`
    SELECT ${metricSelect}
    FROM "UserEvent" e
    WHERE ${wsql}
  `;
  const counts = canonicalMetricRowToCounts(rows[0]);
  return {
    view: counts.impressions,
    open: counts.opens,
    save: counts.saves,
    plan: counts.planAdds,
    click: counts.ctaClicks,
  };
}

function toFunnelSeries(raw: FunnelCounts): AnalyticsFunnelSeries {
  const vals: number[] = [
    raw.view,
    raw.open,
    raw.save,
    raw.plan,
    raw.click,
  ];
  const steps = STEP_ORDER.map((key, i) => {
    const count = vals[i]!;
    const prev = i > 0 ? vals[i - 1]! : null;
    const pctFromPrevious =
      i === 0 ? 100 : prev! > 0 ? round2((count / prev!) * 100) : 0;
    const pctFromFirst =
      raw.view > 0 ? round2((count / raw.view) * 100) : 0;
    return {
      key,
      label: STEP_LABELS[key],
      count,
      pctFromPrevious,
      pctFromFirst,
    };
  });
  return { steps, raw };
}

/**
 * Event-volume decrease only. If a downstream event count is greater than
 * the upstream count (valid for non-sequential volumes), loss is 0 rather
 * than a fake negative drop-off.
 */
function transitionsFromRaw(raw: FunnelCounts): AnalyticsFunnelDropTransition[] {
  const pairs: Array<
    [AnalyticsFunnelStepKey, AnalyticsFunnelStepKey, number, number]
  > = [
    ["view", "open", raw.view, raw.open],
    ["open", "save", raw.open, raw.save],
    ["save", "plan", raw.save, raw.plan],
    ["plan", "click", raw.plan, raw.click],
  ];
  return pairs.map(([from, to, fromCount, toCount]) => {
    const lost = Math.max(0, fromCount - toCount);
    const dropOffPct =
      fromCount > 0 && toCount < fromCount
        ? round2((lost / fromCount) * 100)
        : 0;
    return { from, to, fromCount, toCount, lost, dropOffPct };
  });
}

function sortBiggestDrops(
  list: AnalyticsFunnelDropTransition[],
): AnalyticsFunnelDropTransition[] {
  return [...list].sort((a, b) => b.dropOffPct - a.dropOffPct);
}

async function funnelForScopedFilters(
  filters: AnalyticsOverviewFilters,
): Promise<FunnelCounts> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const allowed = await resolveAnalyticsAllowedUserIds(filters);
  if (allowed && allowed.size === 0) return zeroCounts();
  const wsql = analyticsEventWhereSql(start, end, filters, cityId, allowed);
  return countFunnel(wsql);
}

function toWorstEntities(
  rows: AggRow[],
  titles: Map<string, string>,
  kind: "vo" | "os" | "sp" | "pc",
  minDenom: number,
  take: number,
): AnalyticsFunnelWorstEntity[] {
  const mapped = rows
    .map((r) => {
      const views = Number(r.views);
      const opens = Number(r.opens);
      const saves = Number(r.saves);
      const planAdds = Number(r.plan_adds);
      const cta = Number(r.cta_clicks);
      const key = `${r.entity_type}:${r.entity_id}`;
      let transitionRate = 0;
      let denom = 0;
      if (kind === "vo") {
        denom = views;
        transitionRate = views > 0 ? opens / views : 0;
      } else if (kind === "os") {
        denom = opens;
        transitionRate = opens > 0 ? saves / opens : 0;
      } else if (kind === "sp") {
        denom = saves;
        transitionRate = saves > 0 ? planAdds / saves : 0;
      } else {
        denom = planAdds;
        transitionRate = planAdds > 0 ? cta / planAdds : 0;
      }
      return {
        entityType: r.entity_type,
        entityId: r.entity_id,
        title:
          titles.get(key) ?? `${r.entity_type} ${r.entity_id.slice(0, 8)}…`,
        views,
        opens,
        saves,
        planAdds,
        ctaClicks: cta,
        transitionRate,
        denom,
      };
    })
    .filter((r) => r.denom >= minDenom);

  return [...mapped]
    .sort((a, b) => a.transitionRate - b.transitionRate)
    .slice(0, take)
    .map((r) => ({
      entityType: r.entityType,
      entityId: r.entityId,
      title: r.title,
      views: r.views,
      opens: r.opens,
      saves: r.saves,
      planAdds: r.planAdds,
      ctaClicks: r.ctaClicks,
      transitionRate: r.transitionRate,
    }));
}

function emptyFunnelsResult(
  start: Date,
  end: Date,
): AnalyticsFunnelsResult {
  const zero = toFunnelSeries(zeroCounts());
  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    measurement: "event_volume",
    globalFunnel: zero,
    breakdowns: {
      byEntityType: {},
      byVertical: {},
      bySegment: {},
      byCity: [],
    },
    comparisons: [],
    dropOff: {
      biggestSteps: [],
      byEntity: {
        viewToOpen: [],
        openToSave: [],
        saveToPlan: [],
        planToClick: [],
      },
      byVertical: [],
    },
  };
}

/**
 * First-party interaction-volume analysis.
 *
 * Despite the legacy API/component name, these are aggregate UserEvent counts
 * and count ratios, not ordered user/session conversion. This distinction is
 * explicit so internal business telemetry is not confused with GA4 funnels.
 */
export async function getAnalyticsFunnels(
  filters: AnalyticsOverviewFilters,
): Promise<AnalyticsFunnelsResult> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const allowed = await resolveAnalyticsAllowedUserIds(filters);

  if (allowed && allowed.size === 0) {
    return emptyFunnelsResult(start, end);
  }

  const globalSql = analyticsEventWhereSql(start, end, filters, cityId, allowed);
  const globalRaw = await countFunnel(globalSql);
  const globalFunnel = toFunnelSeries(globalRaw);
  const biggestSteps = sortBiggestDrops(transitionsFromRaw(globalRaw));

  const filtersNoEntity: AnalyticsOverviewFilters = {
    ...filters,
    entity: "all",
  };
  const filtersNoVertical: AnalyticsOverviewFilters = {
    ...filters,
    vertical: "all",
  };
  const filtersNoSegment: AnalyticsOverviewFilters = {
    ...filters,
    segment: "",
  };
  const filtersNoCity: AnalyticsOverviewFilters = { ...filters, city: "" };

  const allowedAgeOnly = await resolveAnalyticsAllowedUserIds(filtersNoSegment);

  const [
    byEntityTypeEntries,
    byVerticalEntries,
    bySegmentEntries,
    cityFunnelRows,
    comparisonRows,
    aggRows,
  ] = await Promise.all([
    Promise.all(
      ENTITY_SLUGS.map(async (slug) => {
        const f: AnalyticsOverviewFilters = {
          ...filtersNoEntity,
          entity: slug,
        };
        const raw = await funnelForScopedFilters(f);
        return [slug.toUpperCase(), toFunnelSeries(raw)] as const;
      }),
    ),
    Promise.all(
      VERTICAL_SLUGS.map(async (slug) => {
        const f: AnalyticsOverviewFilters = {
          ...filtersNoVertical,
          vertical: slug,
        };
        const raw = await funnelForScopedFilters(f);
        return [analyticsVerticalMap()[slug]!, toFunnelSeries(raw)] as const;
      }),
    ),
    Promise.all(
      FUNNEL_SEGMENT_KEYS.map(async (segKey) => {
        const segUsers = await getUserIdsInSegment(segKey);
        const merged = intersectSets(allowedAgeOnly, segUsers);
        if (merged && merged.size === 0) {
          return [segKey, toFunnelSeries(zeroCounts())] as const;
        }
        const cityIdNs = await resolveCityIdFromSlug(filtersNoSegment.city);
        const segmentSql = analyticsEventWhereSql(
          start,
          end,
          filtersNoSegment,
          cityIdNs,
          merged,
        );
        const raw = await countFunnel(segmentSql);
        return [segKey, toFunnelSeries(raw)] as const;
      }),
    ),
    loadCityFunnels(start, end, filtersNoCity, allowed),
    loadComparisons(filters),
    loadAggRowsForWorst(start, end, filters, cityId, allowed),
  ]);

  const byEntityType = Object.fromEntries(byEntityTypeEntries);
  const byVertical = Object.fromEntries(byVerticalEntries);
  const bySegment = Object.fromEntries(bySegmentEntries);

  const verticalFunnelList: AnalyticsFunnelVerticalDrop[] = byVerticalEntries
    .map(([vertical, funnel]) => ({
      vertical,
      funnel,
      transitions: sortBiggestDrops(transitionsFromRaw(funnel.raw)),
    }))
    .sort(
      (a, b) =>
        (b.transitions[0]?.dropOffPct ?? 0) -
        (a.transitions[0]?.dropOffPct ?? 0),
    );

  const titles = await loadAllEntityTitles(
    aggRows.map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
    })),
  );

  const dropOffByEntity = {
    viewToOpen: toWorstEntities(aggRows, titles, "vo", 20, 8),
    openToSave: toWorstEntities(aggRows, titles, "os", 15, 8),
    saveToPlan: toWorstEntities(aggRows, titles, "sp", 8, 8),
    planToClick: toWorstEntities(aggRows, titles, "pc", 5, 8),
  };

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
    measurement: "event_volume",
    globalFunnel,
    breakdowns: {
      byEntityType,
      byVertical,
      bySegment,
      byCity: cityFunnelRows,
    },
    comparisons: comparisonRows,
    dropOff: {
      biggestSteps,
      byEntity: dropOffByEntity,
      byVertical: verticalFunnelList,
    },
  };
}

function zeroCounts(): FunnelCounts {
  return { view: 0, open: 0, save: 0, plan: 0, click: 0 };
}

async function loadCityFunnels(
  start: Date,
  end: Date,
  filtersNoCity: AnalyticsOverviewFilters,
  allowed: Set<string> | null,
): Promise<
  Array<{ citySlug: string; cityName: string; funnel: AnalyticsFunnelSeries }>
> {
  const base = buildAnalyticsBaseEventWhere(start, end, filtersNoCity, null);
  const whereBase = applyAnalyticsUserFilter(base, allowed);

  const cityIds = await prisma.userEvent.groupBy({
    by: ["cityId"],
    where: {
      ...whereBase,
      cityId: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { cityId: "desc" } },
    take: 12,
  });

  const ids = cityIds
    .map((c) => c.cityId)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return [];

  const cities = await prisma.city.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(cities.map((c) => [c.id, c]));

  const out: Array<{
    citySlug: string;
    cityName: string;
    funnel: AnalyticsFunnelSeries;
  }> = [];

  for (const id of ids) {
    const c = byId.get(id);
    if (!c) continue;
    const citySql = analyticsEventWhereSql(
      start,
      end,
      filtersNoCity,
      id,
      allowed,
    );
    const raw = await countFunnel(citySql);
    out.push({
      citySlug: c.slug,
      cityName: c.name,
      funnel: toFunnelSeries(raw),
    });
  }
  return out;
}

async function loadComparisons(
  filters: AnalyticsOverviewFilters,
): Promise<AnalyticsFunnelComparisonPair[]> {
  const em = analyticsEntityMap();
  const vm = analyticsVerticalMap();

  const [evOffer, cityTravel, weekendWeekday] = await Promise.all([
    (async (): Promise<AnalyticsFunnelComparisonPair | null> => {
      const a = await funnelForScopedFilters({
        ...filters,
        entity: "event",
        vertical: filters.vertical,
      });
      const b = await funnelForScopedFilters({
        ...filters,
        entity: "offer",
        vertical: filters.vertical,
      });
      return {
        id: "event_vs_offer",
        label: "EVENT vs OFFER",
        left: {
          key: "EVENT",
          label: em.event ?? "EVENT",
          funnel: toFunnelSeries(a),
        },
        right: {
          key: "OFFER",
          label: em.offer ?? "OFFER",
          funnel: toFunnelSeries(b),
        },
      };
    })(),
    (async (): Promise<AnalyticsFunnelComparisonPair | null> => {
      const a = await funnelForScopedFilters({
        ...filters,
        vertical: "city",
        entity: filters.entity,
      });
      const b = await funnelForScopedFilters({
        ...filters,
        vertical: "travel",
        entity: filters.entity,
      });
      return {
        id: "city_vs_travel",
        label: "Vertical: CITY vs TRAVEL",
        left: {
          key: "CITY",
          label: String(vm.city ?? "CITY"),
          funnel: toFunnelSeries(a),
        },
        right: {
          key: "TRAVEL",
          label: String(vm.travel ?? "TRAVEL"),
          funnel: toFunnelSeries(b),
        },
      };
    })(),
    (async (): Promise<AnalyticsFunnelComparisonPair | null> => {
      const a = await funnelForScopedFilters({
        ...filters,
        segment: "WEEKEND_ORIENTED",
      });
      const b = await funnelForScopedFilters({
        ...filters,
        segment: "WEEKDAY_ORIENTED",
      });
      return {
        id: "weekend_vs_weekday_segment",
        label: "Segment: WEEKEND_ORIENTED vs WEEKDAY_ORIENTED",
        left: {
          key: "WEEKEND_ORIENTED",
          label: "Weekend-oriented",
          funnel: toFunnelSeries(a),
        },
        right: {
          key: "WEEKDAY_ORIENTED",
          label: "Weekday-oriented",
          funnel: toFunnelSeries(b),
        },
      };
    })(),
  ]);

  return [evOffer, cityTravel, weekendWeekday].filter(
    (x): x is AnalyticsFunnelComparisonPair => x !== null,
  );
}

async function loadAggRowsForWorst(
  start: Date,
  end: Date,
  filters: AnalyticsOverviewFilters,
  cityId: string | null,
  allowed: Set<string> | null,
): Promise<AggRow[]> {
  const wsql = analyticsEventWhereSql(start, end, filters, cityId, allowed);

  return prisma.$queryRaw<AggRow[]>`
    SELECT
      e."entityType"::text AS entity_type,
      e."entityId"::text AS entity_id,
      COUNT(*) FILTER (WHERE ${CANONICAL_CARD_IMPRESSION_SQL})::bigint AS views,
      COUNT(*) FILTER (WHERE e."eventType" = 'DETAIL_OPEN')::bigint AS opens,
      COUNT(*) FILTER (WHERE e."eventType" = 'SAVE')::bigint AS saves,
      COUNT(*) FILTER (WHERE e."eventType" = 'PLAN_ADD')::bigint AS plan_adds,
      COUNT(*) FILTER (WHERE ${CANONICAL_CTA_CLICK_SQL})::bigint AS cta_clicks
    FROM "UserEvent" e
    WHERE ${wsql}
      AND e."entityType" IS NOT NULL
      AND e."entityId" IS NOT NULL
    GROUP BY e."entityType", e."entityId"
    HAVING
      COUNT(*) FILTER (WHERE ${CANONICAL_CARD_IMPRESSION_SQL})
      + COUNT(*) FILTER (WHERE e."eventType" = 'DETAIL_OPEN') > 0
  `;
}
