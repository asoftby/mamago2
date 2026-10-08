import type { SeoPage } from "@/lib/admin/seo/domain/types";
import type { SeoGeoContext, SeoPageGeoSnapshot } from "./types";
import type { SeoMarketFilter } from "./seoMarket";

function readGeoSnapshot(row: SeoPage): SeoPageGeoSnapshot {
  const snap = row.filtersSnapshot ?? {};
  return {
    cityId: typeof snap.cityId === "string" ? snap.cityId : null,
    citySlug:
      typeof snap.citySlug === "string"
        ? snap.citySlug
        : typeof snap.city === "string"
          ? snap.city
          : row.entityDiagnostics?.citySlug ?? null,
    regionId: typeof snap.regionId === "string" ? snap.regionId : null,
    geoScope:
      snap.geoScope === "CITY" ||
      snap.geoScope === "REGION" ||
      snap.geoScope === "COUNTRY"
        ? snap.geoScope
        : null,
    countryId: typeof snap.countryId === "string" ? snap.countryId : null,
  };
}

function matchesMarketFilter(row: SeoPage, filter: SeoMarketFilter): boolean {
  if (filter.kind === "all") return true;

  const geo = readGeoSnapshot(row);
  const diagCity = row.entityDiagnostics?.citySlug ?? null;
  const citySlug = geo.citySlug ?? diagCity;

  if (filter.kind === "city") {
    if (geo.geoScope === "REGION" || geo.geoScope === "COUNTRY") return false;
    if (geo.cityId && geo.cityId === filter.cityId) return true;
    if (citySlug && citySlug === filter.citySlug) return true;
    return false;
  }

  if (filter.kind === "region") {
    if (geo.regionId && geo.regionId === filter.regionId) return true;
    if (geo.geoScope === "REGION" && geo.regionId === filter.regionId) return true;
    if (geo.cityId && filter.cityIds.includes(geo.cityId)) return true;
    if (citySlug && filter.citySlugs.includes(citySlug)) return true;
    return false;
  }

  if (filter.kind === "market") {
    // CITY pages in market cities
    const isCountry = geo.geoScope === "COUNTRY";
    if (isCountry) return false;
    if (geo.geoScope === "REGION") {
      return Boolean(filter.regionId && geo.regionId === filter.regionId);
    }
    if (geo.cityId && filter.cityIds.includes(geo.cityId)) return true;
    if (citySlug && filter.citySlugs.includes(citySlug)) return true;
    if (filter.regionId && geo.regionId === filter.regionId) return true;
    return false;
  }

  // country
  if (geo.geoScope === "COUNTRY") return true;
  if (geo.countryId && geo.countryId === filter.countryId) return true;
  return false;
}

/**
 * Filter SEO pages by resolved market filter (city / region / market / country).
 */
export function filterPagesByMarketFilter(
  rows: SeoPage[],
  filter: SeoMarketFilter,
): SeoPage[] {
  if (filter.kind === "all") return rows;
  return rows.filter((row) => matchesMarketFilter(row, filter));
}

/**
 * @deprecated Prefer filterPagesByMarketFilter with resolveSeoMarketFilter.
 * Kept for tests that pass raw SeoGeoContext (city/region/country/all).
 */
export function filterPagesByGeoContext(
  rows: SeoPage[],
  ctx: SeoGeoContext,
): SeoPage[] {
  if (ctx.kind === "all") return filterPagesByMarketFilter(rows, { kind: "all" });
  if (ctx.kind === "city") {
    return filterPagesByMarketFilter(rows, {
      kind: "city",
      cityId: ctx.cityId,
      citySlug: ctx.citySlug,
    });
  }
  if (ctx.kind === "region") {
    return filterPagesByMarketFilter(rows, {
      kind: "region",
      regionId: ctx.regionId,
      cityIds: ctx.cityIds,
      citySlugs: ctx.citySlugs,
    });
  }
  return filterPagesByMarketFilter(rows, {
    kind: "country",
    countryId: ctx.countryId,
  });
}

export function geographyLabelForPage(
  row: SeoPage,
  ctxFallback?: SeoGeoContext,
): string {
  const geo = readGeoSnapshot(row);
  if (geo.geoScope === "COUNTRY") return "Беларусь";
  if (geo.geoScope === "REGION") {
    return typeof row.filtersSnapshot?.regionName === "string"
      ? row.filtersSnapshot.regionName
      : "Регион";
  }
  const citySlug = geo.citySlug ?? row.entityDiagnostics?.citySlug;
  if (typeof row.filtersSnapshot?.cityName === "string") {
    return row.filtersSnapshot.cityName;
  }
  if (citySlug) return citySlug;
  if (ctxFallback?.kind === "city") return ctxFallback.cityName;
  return "—";
}
