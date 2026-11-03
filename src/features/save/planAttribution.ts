/** Optional, non-PII context. The server alone verifies ownership and HOME surface. */
export type HomePlanAttribution = {
  planAddSource: "home-family-picks";
  recommendationExposureId: string | null;
};
export function homePlanAttributionFields(value?: HomePlanAttribution) {
  return value?.planAddSource === "home-family-picks" ? {
    planAddSource: "home-family-picks" as const,
    recommendationExposureId: value.recommendationExposureId,
  } : {};
}
