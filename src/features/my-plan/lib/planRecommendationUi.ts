export const PLAN_RECOMMENDATION_RESULTS_A11Y = {
  tabIndex: -1,
  "aria-live": "polite",
} as const;

export function focusPlanRecommendationResults(
  documentLike: Pick<Document, "getElementById">,
): void {
  const target = documentLike.getElementById("plan-recommendation-results");
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
  target?.focus({ preventScroll: true });
}
