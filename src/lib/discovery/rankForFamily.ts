/**
 * Shared public-listing ranking contract.
 *
 * The caller first builds its candidate list from explicit filters and public
 * visibility rules. Family signals may reorder these candidates but must never
 * change membership. Recommendation-only surfaces may select a subset *after*
 * ranking, subject to their own policy.
 */
export function rankForFamily<T>(
  items: readonly T[],
  score: (item: T, index: number) => number,
): T[] {
  return items
    .map((item, index) => ({ item, index, score: score(item, index) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}
