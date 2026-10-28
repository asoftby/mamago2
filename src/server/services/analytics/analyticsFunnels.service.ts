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
  analyticsIdentityWhereSql,
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
  resolveInternalTrafficExclusion,
  type InternalTrafficExclusion,
} from "@/server/services/analytics/canonicalAudience";
import {
  EMPTY_ORDERED_FUNNEL,
  countOrderedFunnel,
  countOrderedFunnelByEntity,
  type OrderedFunnelCounts,
} from "@/server/services/analytics/orderedUserFunnel";

const STEP_ORDER: AnalyticsFunnelStepKey[] = [
  "view",
  "open",
  "save",
  "plan",
  "click",
];

/**
 * Подписи шагов. Воронка пользовательская (D8): считаются уникальные люди, а не
 * события; «Сохранили», «Добавили в план» и «Перешли к партнёру» — отдельные
 * ветки от «Открыли» (действие не раньше первого открытия), поэтому каждая доля
 * этих шагов — доля открывших и не превышает 100%.
 */
const STEP_LABELS: Record<AnalyticsFunnelStepKey, string> = {
  view: "Видели контент",
  open: "Открыли карточку",
  save: "Сохранили (после открытия)",
  plan: "Добавили в план (после открытия)",
  click: "Перешли к партнёру (после открытия)",
};

/** Сегменты для вкладки Funnels (основные продуктовые). */
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

type FunnelCounts = OrderedFunnelCounts;

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
    // save / plan / click are branches of "open": their parent is "open", not the previous step.
    const parent = i === 0 ? null : i === 1 ? raw.view : raw.open;
    const pctFromPrevious =
      i === 0 ? 100 : parent! > 0 ? round2((count / parent!) * 100) : 0;
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

function transitionsFromRaw(raw: FunnelCounts): AnalyticsFunnelDropTransition[] {
  const pairs: Array<
    [AnalyticsFunnelStepKey, AnalyticsFunnelStepKey, number, number]
  > = [
    ["view", "open", raw.view, raw.open],
    ["open", "save", raw.open, raw.save],
    ["open", "plan", raw.open, raw.plan],
    ["open", "click", raw.open, raw.click],
  ];
  return pairs.map(([from, to, fromCount, toCount]) => {
    const lost = Math.max(0, fromCount - toCount);
    const dropOffPct =
      fromCount > 0 ? round2((1 - toCount / fromCount) * 100) : 0;
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
  exclusion: InternalTrafficExclusion,
): Promise<FunnelCounts> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const allowed = await resolveAnalyticsAllowedUserIds(filters);
  if (allowed && allowed.size === 0) {
    return { ...EMPTY_ORDERED_FUNNEL };
  }
  return countOrderedFunnel(analyticsEventWhereSql(start, end, filters, cityId, allowed, exclusion), analyticsIdentityWhereSql(start, end, exclusion));
}

type AggRow = {
  entity_type: string;
  entity_id: string;
  views: bigint;
  opens: bigint;
  saves: bigint;
  plan_adds: bigint;
  cta_clicks: bigint;
};

function toWorstEntities(
  rows: AggRow[],
  titles: Map<string, string>,
  kind: "vo" | "os" | "op" | "oc",
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
      } else if (kind === "op") {
        denom = opens;
        transitionRate = opens > 0 ? planAdds / opens : 0;
      } else {
        denom = opens;
        transitionRate = opens > 0 ? cta / opens : 0;
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
  const zero = toFunnelSeries({ ...EMPTY_ORDERED_FUNNEL });
  return {
    range: { start: start.toISOString(), end: end.toISOString() },
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
        openToPlan: [],
        openToClick: [],
      },
      byVertical: [],
    },
  };
}

/**
 * Полная воронка продукта и разрезы (только агрегаты UserEvent).
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
  const exclusion = await resolveInternalTrafficExclusion(prisma, start, end);

  const globalRaw = await countOrderedFunnel(
    analyticsEventWhereSql(start, end, filters, cityId, allowed, exclusion),
    analyticsIdentityWhereSql(start, end, exclusion),
  );
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
        const raw = await funnelForScopedFilters(f, exclusion);
        return [slug.toUpperCase(), toFunnelSeries(raw)] as const;
      }),
    ),
    Promise.all(
      VERTICAL_SLUGS.map(async (slug) => {
        const f: AnalyticsOverviewFilters = {
          ...filtersNoVertical,
          vertical: slug,
        };
        const raw = await funnelForScopedFilters(f, exclusion);
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
        const raw = await countOrderedFunnel(
          analyticsEventWhereSql(start, end, filtersNoSegment, cityIdNs, merged, exclusion),
          analyticsIdentityWhereSql(start, end, exclusion),
        );
        return [segKey, toFunnelSeries(raw)] as const;
      }),
    ),
    loadCityFunnels(start, end, filtersNoCity, allowed, exclusion),
    loadComparisons(filters, exclusion),
    loadAggRowsForWorst(start, end, filters, cityId, allowed, exclusion),
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
    openToPlan: toWorstEntities(aggRows, titles, "op", 15, 8),
    openToClick: toWorstEntities(aggRows, titles, "oc", 15, 8),
  };

  return {
    range: { start: start.toISOString(), end: end.toISOString() },
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
  return { ...EMPTY_ORDERED_FUNNEL };
}

async function loadCityFunnels(
  start: Date,
  end: Date,
  filtersNoCity: AnalyticsOverviewFilters,
  allowed: Set<string> | null,
  exclusion: InternalTrafficExclusion,
): Promise<
  Array<{ citySlug: string; cityName: string; funnel: AnalyticsFunnelSeries }>
> {
  const cityIdBase = await resolveCityIdFromSlug(filtersNoCity.city);
  const base = buildAnalyticsBaseEventWhere(
    start,
    end,
    filtersNoCity,
    cityIdBase,
    exclusion,
  );
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
    const raw = await countOrderedFunnel(
      analyticsEventWhereSql(start, end, filtersNoCity, id, allowed, exclusion),
      analyticsIdentityWhereSql(start, end, exclusion),
    );
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
  exclusion: InternalTrafficExclusion,
): Promise<AnalyticsFunnelComparisonPair[]> {
  const em = analyticsEntityMap();
  const vm = analyticsVerticalMap();

  const [evOffer, cityTravel, weekendWeekday] = await Promise.all([
    (async (): Promise<AnalyticsFunnelComparisonPair | null> => {
      const a = await funnelForScopedFilters({
        ...filters,
        entity: "event",
        vertical: filters.vertical,
      }, exclusion);
      const b = await funnelForScopedFilters({
        ...filters,
        entity: "offer",
        vertical: filters.vertical,
      }, exclusion);
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
      }, exclusion);
      const b = await funnelForScopedFilters({
        ...filters,
        vertical: "travel",
        entity: filters.entity,
      }, exclusion);
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
      }, exclusion);
      const b = await funnelForScopedFilters({
        ...filters,
        segment: "WEEKDAY_ORIENTED",
      }, exclusion);
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
  exclusion: InternalTrafficExclusion,
): Promise<AggRow[]> {
  const rows = await countOrderedFunnelByEntity(
    analyticsEventWhereSql(start, end, filters, cityId, allowed, exclusion),
    analyticsIdentityWhereSql(start, end, exclusion),
  );
  return rows
    .filter((r) => r.view > 0)
    .map((r) => ({
      entity_type: r.entityType,
      entity_id: r.entityId,
      views: BigInt(r.view),
      opens: BigInt(r.open),
      saves: BigInt(r.save),
      plan_adds: BigInt(r.plan),
      cta_clicks: BigInt(r.click),
    }));
}
