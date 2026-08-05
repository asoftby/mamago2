/**
 * Public “Популярное” chips under the search field.
 *
 * Current architecture (audit):
 * - SearchResults / MobileSearch historically rendered a hardcoded candidate list.
 * - That list is NOT read from admin SearchQuickTag and does NOT use SearchQueryLog.
 * - Admin `/admin/search/quick-tags` manages SearchQuickTag (CRUD) but has no public consumer.
 * - Admin `/admin/search` “Popular Search Queries” is mock UI, not live analytics.
 * - Real query volume lives in SearchQueryLog (written by logSearchQuery on /api/search).
 *
 * Visibility rule: a tag is shown only when it has ≥ MIN_POPULAR_TAG_SEARCH_COUNT
 * logged searches. Until the public UI is wired to those counts (or to Quick Tags + counts),
 * resolveVisiblePopularTags() returns [] and the “Популярное” block stays hidden.
 */

/** Minimum SearchQueryLog hits required before a tag appears in public “Популярное”. */
export const MIN_POPULAR_TAG_SEARCH_COUNT = 20;

/**
 * Legacy hardcoded candidates (kept for future wiring to SearchQueryLog / Quick Tags).
 * Do not render directly — always go through resolveVisiblePopularTags().
 */
export const POPULAR_SEARCH_TAG_CANDIDATES = [
  "Театр",
  "Батуты",
  "Мастер-классы",
  "Логопед",
  "Аниматоры",
] as const;

/**
 * Filters candidates by logged search volume.
 * Pass counts keyed by normalized (trim + lower case) query text.
 */
export function resolveVisiblePopularTags(
  countsByNormalizedQuery: Record<string, number> = {},
  candidates: readonly string[] = POPULAR_SEARCH_TAG_CANDIDATES,
  minCount: number = MIN_POPULAR_TAG_SEARCH_COUNT,
): string[] {
  return candidates.filter((term) => {
    const key = term.trim().toLowerCase();
    return (countsByNormalizedQuery[key] ?? 0) >= minCount;
  });
}
