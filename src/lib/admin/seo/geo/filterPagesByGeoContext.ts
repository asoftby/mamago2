import type { SeoPage } from "@/lib/admin/seo/domain/types";
import type { SeoGeoContext, SeoPageGeoSnapshot } from "./types";

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

/**
 * Filter SEO pages by the active Geo SEO Context.
 * "all" returns everything. City/region/country scopes keep pages that
 * clearly belong to that geography; pages without geo signals are kept
 * only in "all" (avoid mixing cities by dumping unknown into a city view).
 */
export function filterPagesByGeoContext(
  rows: SeoPage[],
  ctx: SeoGeoContext,
): SeoPage[] {
  if (ctx.kind === "all") return rows;

  return rows.filter((row) => {
    const geo = readGeoSnapshot(row);
    const diagCity = row.entityDiagnostics?.citySlug ?? null;
    const citySlug = geo.citySlug ?? diagCity;

    if (ctx.kind === "city") {
      if (geo.cityId && geo.cityId === ctx.cityId) return true;
      if (citySlug && citySlug === ctx.citySlug) return true;
      // REGION/COUNTRY articles are not city-local for this selector
      if (geo.geoScope === "REGION" || geo.geoScope === "COUNTRY") return false;
      return false;
    }

    if (ctx.kind === "region") {
      if (geo.regionId && geo.regionId === ctx.regionId) return true;
      if (geo.geoScope === "REGION" && geo.regionId === ctx.regionId) return true;
      if (geo.cityId && ctx.cityIds.includes(geo.cityId)) return true;
      if (citySlug && ctx.citySlugs.includes(citySlug)) return true;
      return false;
    }

    // country
    if (geo.geoScope === "COUNTRY") return true;
    if (geo.countryId && geo.countryId === ctx.countryId) return true;
    return false;
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
