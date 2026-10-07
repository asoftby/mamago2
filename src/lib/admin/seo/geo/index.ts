/**
 * Client-safe Geo SEO exports (no next/headers, no Prisma).
 * Server helpers: `./loadSeoGeoCatalog`, `./resolveSeoGeoSession`.
 */
export {
  SEO_GEO_CONTEXT_COOKIE,
  SEO_GEO_CONTEXT_QUERY,
  DEFAULT_GEO_CONTENT_MIX,
  allocateGeoMixTargets,
  buildGeoMixProgress,
  formatSeoGeoContextBreadcrumb,
  isSeoGeoContextToken,
  prismaGeoScopeToSeoKind,
  seoGeoContextToToken,
  seoScopeKindToPrisma,
  type GeoContentMix,
  type GeoContentMixProgress,
  type SeoGeoContext,
  type SeoGeoContextKind,
  type SeoGeoContextToken,
  type SeoGeoScopeKind,
  type SeoGeoSelectorOption,
  type SeoPageGeoSnapshot,
} from "./types";

export {
  filterPagesByGeoContext,
  filterPagesByMarketFilter,
  geographyLabelForPage,
} from "./filterPagesByGeoContext";

export {
  SEO_MARKET_VIEW_COOKIE,
  SEO_MARKET_VIEW_QUERY,
  enrichMarketFilterWithRegionCities,
  isSeoMarketViewScope,
  normalizeSearchQueryKey,
  parseSeoMarketViewScope,
  presentSeoMarket,
  resolveSeoMarketFilter,
  type SeoMarketFilter,
  type SeoMarketPresentation,
  type SeoMarketViewScope,
} from "./seoMarket";

export {
  SEO_MARKET_REGION_BY_CITY_SLUG,
  resolveSeoMarketRegionForCity,
} from "./resolveSeoMarketRegion";
