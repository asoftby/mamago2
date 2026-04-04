import type { Prisma, UserEventType } from "@prisma/client";
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

const VIEW_TYPES: UserEventType[] = ["PAGE_VIEW", "CARD_VIEW"];

const STEP_ORDER: AnalyticsFunnelStepKey[] = [
  "view",
  "open",
  "save",
  "plan",
  "click",
];

/** Подписи шагов = типы UserEvent (view = PAGE_VIEW + CARD_VIEW). */
const STEP_LABELS: Record<AnalyticsFunnelStepKey, string> = {
  view: "Views (PAGE + CARD)",
  open: "DETAIL_OPEN",
  save: "SAVE",
  plan: "PLAN_ADD",
  click: "CTA_CLICK",
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

type FunnelCounts = {
  view: number;
  open: number;
  save: number;
  plan: number;
  click: number;
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

async function countFunnel(
  where: Prisma.UserEventWhereInput,
): Promise<FunnelCounts> {
  const [view, open, save, plan, click] = await Promise.all([
    prisma.userEvent.count({
      where: { ...where, eventType: { in: VIEW_TYPES } },
    }),
    prisma.userEvent.count({
      where: { ...where, eventType: "DETAIL_OPEN" },
    }),
    prisma.userEvent.count({
      where: { ...where, eventType: "SAVE" },
    }),
    prisma.userEvent.count({
      where: { ...where, eventType: "PLAN_ADD" },
    }),
    prisma.userEvent.count({
      where: { ...where, eventType: "CTA_CLICK" },
    }),
  ]);
  return { view, open, save, plan, click };
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
): Promise<FunnelCounts> {
  const { start, end } = resolveAnalyticsDateRange(filters.dateRange);
  const cityId = await resolveCityIdFromSlug(filters.city);
  const allowed = await resolveAnalyticsAllowedUserIds(filters);
  if (allowed && allowed.size === 0) {
    return { view: 0, open: 0, save: 0, plan: 0, click: 0 };
  }
  const base = buildAnalyticsBaseEventWhere(start, end, filters, cityId);
  const where = applyAnalyticsUserFilter(base, allowed);
  return countFunnel(where);
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
  const zero = toFunnelSeries({
    view: 0,
    open: 0,
    save: 0,
    plan: 0,
    click: 0,
  });
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
        saveToPlan: [],
        planToClick: [],
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

  const baseWhere = buildAnalyticsBaseEventWhere(start, end, filters, cityId);
  const where = applyAnalyticsUserFilter(baseWhere, allowed);
  const globalRaw = await countFunnel(where);
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
        const baseNs = buildAnalyticsBaseEventWhere(
          start,
          end,
          filtersNoSegment,
          cityIdNs,
        );
        const whereNs = applyAnalyticsUserFilter(baseNs, merged);
        const raw = await countFunnel(whereNs);
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
  const cityIdBase = await resolveCityIdFromSlug(filtersNoCity.city);
  const base = buildAnalyticsBaseEventWhere(
    start,
    end,
    filtersNoCity,
    cityIdBase,
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
    const w = applyAnalyticsUserFilter(
      buildAnalyticsBaseEventWhere(start, end, filtersNoCity, id),
      allowed,
    );
    const raw = await countFunnel(w);
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
  const base = buildAnalyticsBaseEventWhere(start, end, filters, cityId);
  const where = applyAnalyticsUserFilter(base, allowed);

  const types: UserEventType[] = [
    ...VIEW_TYPES,
    "DETAIL_OPEN",
    "SAVE",
    "PLAN_ADD",
    "CTA_CLICK",
  ];

  const rows = await prisma.userEvent.groupBy({
    by: ["entityType", "entityId", "eventType"],
    where: {
      ...where,
      entityType: { not: null },
      entityId: { not: null },
      eventType: { in: types },
    },
    _count: { _all: true },
  });

  const map = new Map<
    string,
    {
      entity_type: string;
      entity_id: string;
      views: bigint;
      opens: bigint;
      saves: bigint;
      plan_adds: bigint;
      cta_clicks: bigint;
    }
  >();

  for (const r of rows) {
    const et = r.entityType;
    const eid = r.entityId;
    if (!et || !eid) continue;
    const k = `${et}:${eid}`;
    let row = map.get(k);
    if (!row) {
      row = {
        entity_type: et,
        entity_id: eid,
        views: BigInt(0),
        opens: BigInt(0),
        saves: BigInt(0),
        plan_adds: BigInt(0),
        cta_clicks: BigInt(0),
      };
      map.set(k, row);
    }
    const c = BigInt(r._count._all);
    if (r.eventType === "PAGE_VIEW" || r.eventType === "CARD_VIEW") {
      row.views += c;
    } else if (r.eventType === "DETAIL_OPEN") {
      row.opens += c;
    } else if (r.eventType === "SAVE") {
      row.saves += c;
    } else if (r.eventType === "PLAN_ADD") {
      row.plan_adds += c;
    } else if (r.eventType === "CTA_CLICK") {
      row.cta_clicks += c;
    }
  }

  return [...map.values()].filter(
    (r) => Number(r.views) + Number(r.opens) > 0,
  ) as AggRow[];
}
