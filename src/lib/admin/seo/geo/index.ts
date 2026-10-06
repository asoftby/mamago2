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
  geographyLabelForPage,
} from "./filterPagesByGeoContext";
