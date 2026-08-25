/**
 * Shared guard logic for the account-specific `/api/save/status` check used
 * by SaveHeart, PlaceSaveHeart, ArticleSaveHeart, OfferPageView,
 * EventPageView and ConversionEventPageView.
 *
 * Extracted as pure functions (rather than a shared hook) so the guest /
 * duplicate-request fix is unit-testable without a DOM — this repo's test
 * harness has no jsdom/RTL (see SaveToPlanModal.test.tsx).
 */

/** A guest has no account-specific status to fetch — the client already knows this. */
export function shouldFetchOwnSaveStatus(isAuthenticated: boolean): boolean {
  return isAuthenticated;
}

/**
 * The initial-mount effect already loads the status once. A second effect
 * that reacts to the save-flow modal closing must only refetch once the
 * user has actually opened that modal at least once — otherwise it fires
 * again on the very first render (modal starts closed) and duplicates the
 * initial request.
 */
export function shouldRefetchAfterFlowClose(params: {
  flowOpen: boolean;
  hasOpenedOnce: boolean;
}): boolean {
  if (params.flowOpen) return false;
  return params.hasOpenedOnce;
}
