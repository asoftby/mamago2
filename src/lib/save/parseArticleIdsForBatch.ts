/** Hard cap on ids per request — bounds DB work for a batched card-grid save-status check. */
export const MAX_ARTICLE_IDS_PER_BATCH = 40;

/**
 * Validates + normalizes the `articleIds` payload for the batch save-status
 * endpoint: keeps only non-empty strings, dedupes, and caps at
 * MAX_ARTICLE_IDS_PER_BATCH. Returns [] for anything malformed.
 */
export function parseArticleIdsForBatch(
  rawIds: unknown,
  max: number = MAX_ARTICLE_IDS_PER_BATCH,
): string[] {
  if (!Array.isArray(rawIds)) return [];
  const deduped = Array.from(
    new Set(rawIds.filter((id): id is string => typeof id === "string" && id.length > 0)),
  );
  return deduped.slice(0, max);
}
