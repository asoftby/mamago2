/**
 * SEO market association for administratively separate cities.
 *
 * This is NOT City.region / administrative membership. Minsk stays with
 * `regionId = null` in the geo hierarchy; SEO still treats Минская область
 * as its product market region for labels, scopes, and MARKET filters.
 */

export const SEO_MARKET_REGION_BY_CITY_SLUG = {
  minsk: "minskaya-oblast",
} as const;

export type SeoMarketRegionRef = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Resolve the SEO market region for a city.
 *
 * 1. Administrative `city.regionId` when present.
 * 2. Otherwise explicit SEO market mapping by stable city slug.
 */
export function resolveSeoMarketRegionForCity(
  city: {
    slug: string;
    regionId: string | null;
    region?: SeoMarketRegionRef | null;
  },
  regions: SeoMarketRegionRef[],
): SeoMarketRegionRef | null {
  if (city.regionId != null) {
    if (city.region && city.region.id === city.regionId) {
      return city.region;
    }
    return regions.find((region) => region.id === city.regionId) ?? null;
  }

  const marketSlug =
    SEO_MARKET_REGION_BY_CITY_SLUG[
      city.slug as keyof typeof SEO_MARKET_REGION_BY_CITY_SLUG
    ];
  if (!marketSlug) return null;
  return regions.find((region) => region.slug === marketSlug) ?? null;
}
