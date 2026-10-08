/**
 * SEO Market = product view over Geo SEO Context.
 * For a selected city: CITY + SEO market REGION (`seoMarketRegionId`),
 * which may come from administrative City.regionId or an explicit slug map
 * for administratively separate cities (e.g. Minsk → minskaya-oblast).
 * View scope filters which slice of that market (or country) is shown.
 */

import type { SeoGeoContext } from "./types";

export const SEO_MARKET_VIEW_COOKIE = "mamago_seo_market_view";
export const SEO_MARKET_VIEW_QUERY = "marketView";

export type SeoMarketViewScope = "market" | "city" | "region" | "country";

export const SEO_MARKET_VIEW_SCOPES: readonly SeoMarketViewScope[] = [
  "market",
  "city",
  "region",
  "country",
] as const;

export function isSeoMarketViewScope(value: string): value is SeoMarketViewScope {
  return (SEO_MARKET_VIEW_SCOPES as readonly string[]).includes(value);
}

/**
 * Resolved filter pushed into provider queries and in-memory filters.
 * `market` = selected city + its region's cities + REGION-scoped content for that region.
 * Does NOT include COUNTRY unless viewScope is country.
 */
export type SeoMarketFilter =
  | { kind: "all" }
  | { kind: "city"; cityId: string; citySlug: string }
  | {
      kind: "region";
      regionId: string;
      cityIds: string[];
      citySlugs: string[];
    }
  | {
      kind: "market";
      cityId: string;
      citySlug: string;
      regionId: string | null;
      regionName: string | null;
      /** Unique city ids: selected city + all cities of its region (no double-count). */
      cityIds: string[];
      citySlugs: string[];
    }
  | { kind: "country"; countryId: string };

export type SeoMarketPresentation = {
  /** Product label e.g. "Минск + Минская область" */
  marketLabel: string;
  cityName: string | null;
  regionName: string | null;
  countryName: string | null;
  /** Whether CITY/REGION/MARKET chips make sense for the current anchor. */
  supportsMarketScopes: boolean;
};

export function parseSeoMarketViewScope(
  raw: string | undefined | null,
): SeoMarketViewScope {
  if (raw && isSeoMarketViewScope(raw)) return raw;
  return "market";
}

/**
 * Build presentation labels from the active geo context (cookie/city selection).
 */
export function presentSeoMarket(context: SeoGeoContext): SeoMarketPresentation {
  if (context.kind === "all") {
    return {
      marketLabel: "Все регионы",
      cityName: null,
      regionName: null,
      countryName: null,
      supportsMarketScopes: false,
    };
  }
  if (context.kind === "city") {
    const regionName = context.seoMarketRegionName;
    const marketLabel = regionName
      ? `${context.cityName} + ${regionName}`
      : context.cityName;
    return {
      marketLabel,
      cityName: context.cityName,
      regionName,
      countryName: context.countryName,
      supportsMarketScopes: Boolean(regionName),
    };
  }
  if (context.kind === "region") {
    return {
      marketLabel: context.regionName,
      cityName: null,
      regionName: context.regionName,
      countryName: context.countryName,
      supportsMarketScopes: false,
    };
  }
  return {
    marketLabel: context.countryName,
    cityName: null,
    regionName: null,
    countryName: context.countryName,
    supportsMarketScopes: false,
  };
}

/**
 * Resolve the DB/list filter from geo context + market view scope.
 *
 * Rules:
 * - context=all → all (viewScope ignored)
 * - context=country → country (viewScope ignored except country)
 * - context=region → region filter (market/city collapse to region)
 * - context=city + market → city ∪ region cities ∪ REGION articles
 * - context=city + city → city only
 * - context=city + region → region of that city (if any)
 * - context=city + country → country of that city
 */
export function resolveSeoMarketFilter(
  context: SeoGeoContext,
  viewScope: SeoMarketViewScope,
): SeoMarketFilter {
  if (context.kind === "all") return { kind: "all" };

  if (context.kind === "country") {
    return { kind: "country", countryId: context.countryId };
  }

  if (context.kind === "region") {
    if (viewScope === "country") {
      return { kind: "country", countryId: context.countryId };
    }
    return {
      kind: "region",
      regionId: context.regionId,
      cityIds: context.cityIds,
      citySlugs: context.citySlugs,
    };
  }

  // city anchor
  if (viewScope === "country") {
    return { kind: "country", countryId: context.countryId };
  }

  if (viewScope === "city") {
    return {
      kind: "city",
      cityId: context.cityId,
      citySlug: context.citySlug,
    };
  }

  if (viewScope === "region") {
    if (!context.seoMarketRegionId) {
      // No SEO market region — fall back to city-only rather than empty market.
      return {
        kind: "city",
        cityId: context.cityId,
        citySlug: context.citySlug,
      };
    }
    return {
      kind: "region",
      regionId: context.seoMarketRegionId,
      cityIds: [], // filled by caller if needed — see resolve with catalog
      citySlugs: [],
    };
  }

  // market (default)
  return {
    kind: "market",
    cityId: context.cityId,
    citySlug: context.citySlug,
    regionId: context.seoMarketRegionId,
    regionName: context.seoMarketRegionName,
    cityIds: [context.cityId],
    citySlugs: [context.citySlug],
  };
}

/**
 * Enrich market/region filters with region city membership from catalog data.
 */
export function enrichMarketFilterWithRegionCities(
  filter: SeoMarketFilter,
  regionCities: { id: string; slug: string }[],
): SeoMarketFilter {
  if (filter.kind === "region") {
    const cityIds = uniqueIds(regionCities.map((c) => c.id));
    const citySlugs = uniqueIds(regionCities.map((c) => c.slug));
    return { ...filter, cityIds, citySlugs };
  }
  if (filter.kind === "market") {
    const cityIds = uniqueIds([
      filter.cityId,
      ...regionCities.map((c) => c.id),
    ]);
    const citySlugs = uniqueIds([
      filter.citySlug,
      ...regionCities.map((c) => c.slug),
    ]);
    return { ...filter, cityIds, citySlugs };
  }
  return filter;
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeSearchQueryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}
