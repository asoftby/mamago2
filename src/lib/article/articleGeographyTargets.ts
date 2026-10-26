import type { GeoScope, Prisma } from "@prisma/client";
import { DEFAULT_COUNTRY_ISO } from "@/server/geo/geoConstants";

export type ArticleGeographyTargetInput =
  | { type: "CITY"; cityId: string; regionId?: never }
  | { type: "REGION"; regionId: string; cityId?: never };

export function geographyTargetKey(target: ArticleGeographyTargetInput): string {
  return target.type === "CITY" ? `CITY:${target.cityId}` : `REGION:${target.regionId}`;
}

export function assertArticleGeographyTargetShape(
  targets: ArticleGeographyTargetInput[],
  primary: { geoScope: GeoScope | null; cityId: string | null; regionId: string | null },
): void {
  const keys = targets.map(geographyTargetKey);
  if (new Set(keys).size !== keys.length) throw new Error("Дополнительные города и регионы не должны повторяться");
  const primaryKey = primary.geoScope === "CITY" && primary.cityId
    ? `CITY:${primary.cityId}`
    : primary.geoScope === "REGION" && primary.regionId
      ? `REGION:${primary.regionId}`
      : null;
  if (primaryKey && keys.includes(primaryKey)) {
    throw new Error("Основная география не должна повторяться в дополнительных городах и регионах");
  }
}

export function buildArticleCityDiscoveryWhere(city: { id: string; regionId?: string | null }, includeCountry = false): Prisma.ArticleWhereInput {
  return {
    OR: [
      { geoScope: "CITY", cityId: city.id },
      ...(city.regionId ? [{ geoScope: "REGION" as const, regionId: city.regionId }] : []),
      ...(includeCountry ? [{ geoScope: "COUNTRY" as const }] : []),
      { additionalGeographyTargets: { some: { OR: [
        { type: "CITY", cityId: city.id },
        ...(city.regionId ? [{ type: "REGION" as const, regionId: city.regionId }] : []),
      ] } } },
    ],
  };
}


/**
 * Journal browsing is country-wide: a family based in Minsk can discover an
 * article about Grodno without explicitly switching cities. Geographic scope
 * still determines the article's canonical URL, never who is allowed to see it.
 *
 * All non-national records are constrained to the same country as the site;
 * this prevents content bleeding across countries when mamaGo expands.
 */
export function buildArticleCountryDiscoveryWhere(
  countryIsoCode: string = DEFAULT_COUNTRY_ISO,
): Prisma.ArticleWhereInput {
  return {
    OR: [
      { geoScope: "COUNTRY" },
      { geoScope: "REGION", region: { country: { isoCode: countryIsoCode } } },
      { geoScope: "CITY", city: { country: { isoCode: countryIsoCode } } },
    ],
  };
}
