/**
 * Cache-Control for unauthenticated reference APIs (cities, geo lists).
 * CDN/browser may reuse responses; data changes rarely.
 */
export const REFERENCE_DATA_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
