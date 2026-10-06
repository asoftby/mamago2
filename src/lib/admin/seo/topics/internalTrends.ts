import prisma from "@/lib/prisma";
import type { SeoMarketFilter } from "@/lib/admin/seo/geo/seoMarket";
import { normalizeSearchQueryKey } from "@/lib/admin/seo/geo/seoMarket";
import {
  computeOpportunityScore,
  computeTrendDirection,
} from "./opportunityScore";

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function cityIdsForFilter(filter: SeoMarketFilter): string[] | null {
  if (filter.kind === "all") return null;
  if (filter.kind === "city") return [filter.cityId];
  if (filter.kind === "region" || filter.kind === "market") {
    return filter.cityIds.length ? filter.cityIds : [];
  }
  // country: SearchQueryLog has no country — cannot filter by country directly
  return [];
}

export type InternalTrendRow = {
  query: string;
  queryKey: string;
  searchesCurrent: number;
  searchesPrevious: number;
  zeroResultCount: number;
  zeroResultShare: number;
  lastSearched: Date | null;
  trendLabel: string;
  trendDirection: "up" | "down" | "flat" | "new";
  deltaAbs: number;
  opportunityScore: number;
  opportunityTier: "high" | "medium" | "low";
  opportunityLabel: string;
  geographyLabel: string;
};

export async function computeInternalSearchTrends(input: {
  filter: SeoMarketFilter;
  geographyLabel: string;
  now?: Date;
}): Promise<{
  rows: InternalTrendRow[];
  risingCount: number;
  highPotentialCount: number;
  windowDays: number;
  /** Recent SearchQueryLog rows with cityId=null exist while geo filter returned 0. */
  showUnknownGeoHint: boolean;
}> {
  const now = input.now ?? new Date();
  const currentFrom = new Date(now.getTime() - WINDOW_MS);
  const previousFrom = new Date(now.getTime() - 2 * WINDOW_MS);
  const cityIds = cityIdsForFilter(input.filter);

  // Country view has no city mapping in SearchQueryLog → empty
  if (cityIds && cityIds.length === 0 && input.filter.kind !== "all") {
    return {
      rows: [],
      risingCount: 0,
      highPotentialCount: 0,
      windowDays: 7,
      showUnknownGeoHint: false,
    };
  }

  const cityWhere =
    cityIds === null
      ? {}
      : { cityId: { in: cityIds } };

  const [currentLogs, previousLogs] = await Promise.all([
    prisma.searchQueryLog.findMany({
      where: {
        ...cityWhere,
        createdAt: { gte: currentFrom, lt: now },
      },
      select: {
        query: true,
        resultsCount: true,
        createdAt: true,
      },
    }),
    prisma.searchQueryLog.findMany({
      where: {
        ...cityWhere,
        createdAt: { gte: previousFrom, lt: currentFrom },
      },
      select: {
        query: true,
        resultsCount: true,
      },
    }),
  ]);

  type Agg = {
    query: string;
    queryKey: string;
    current: number;
    previous: number;
    zero: number;
    last: Date | null;
  };

  const map = new Map<string, Agg>();

  for (const row of currentLogs) {
    const key = normalizeSearchQueryKey(row.query);
    if (!key) continue;
    const agg = map.get(key) ?? {
      query: row.query.trim(),
      queryKey: key,
      current: 0,
      previous: 0,
      zero: 0,
      last: null,
    };
    agg.current += 1;
    if (row.resultsCount === 0) agg.zero += 1;
    if (!agg.last || row.createdAt > agg.last) agg.last = row.createdAt;
    map.set(key, agg);
  }

  for (const row of previousLogs) {
    const key = normalizeSearchQueryKey(row.query);
    if (!key) continue;
    const agg = map.get(key) ?? {
      query: row.query.trim(),
      queryKey: key,
      current: 0,
      previous: 0,
      zero: 0,
      last: null,
    };
    agg.previous += 1;
    map.set(key, agg);
  }

  const rows: InternalTrendRow[] = [];
  for (const agg of map.values()) {
    if (agg.current === 0 && agg.previous === 0) continue;
    const zeroResultShare =
      agg.current === 0 ? 0 : agg.zero / agg.current;
    const trend = computeTrendDirection(agg.current, agg.previous);
    const opportunity = computeOpportunityScore({
      searchesCurrent: agg.current,
      searchesPrevious: agg.previous,
      zeroResultShare,
    });
    rows.push({
      query: agg.query,
      queryKey: agg.queryKey,
      searchesCurrent: agg.current,
      searchesPrevious: agg.previous,
      zeroResultCount: agg.zero,
      zeroResultShare,
      lastSearched: agg.last,
      trendLabel: trend.label,
      trendDirection: trend.direction,
      deltaAbs: trend.deltaAbs,
      opportunityScore: opportunity.score,
      opportunityTier: opportunity.tier,
      opportunityLabel: opportunity.label,
      geographyLabel: input.geographyLabel,
    });
  }

  rows.sort((a, b) => {
    if (b.opportunityScore !== a.opportunityScore) {
      return b.opportunityScore - a.opportunityScore;
    }
    return b.searchesCurrent - a.searchesCurrent;
  });

  let showUnknownGeoHint = false;
  // Only when a geo-scoped market filter yields no attributed traffic, hint
  // that older ungeotagged logs exist — never treat null as Minsk.
  if (rows.length === 0 && cityIds !== null) {
    const unknownCount = await prisma.searchQueryLog.count({
      where: {
        cityId: null,
        createdAt: { gte: previousFrom, lt: now },
      },
    });
    showUnknownGeoHint = unknownCount > 0;
  }

  return {
    rows,
    risingCount: rows.filter(
      (r) => r.trendDirection === "up" || r.trendDirection === "new",
    ).length,
    highPotentialCount: rows.filter((r) => r.opportunityTier === "high")
      .length,
    windowDays: 7,
    showUnknownGeoHint,
  };
}
