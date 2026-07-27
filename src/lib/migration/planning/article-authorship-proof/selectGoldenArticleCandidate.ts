import type { ArticleAuthorshipEntry } from "./types";

/**
 * Deterministic selection among `ARTICLE_TARGET_NOT_MIGRATED` entries: pick
 * the lowest legacy WordPress post ID (entries are already sorted by
 * sourceRecordKey, i.e. numerically by post ID, in `buildArticleAuthorshipProof`).
 * Returns `null` when there is no such entry.
 */
export function selectGoldenArticleCandidate(entries: readonly ArticleAuthorshipEntry[]): ArticleAuthorshipEntry | null {
  const candidates = entries.filter(entry => entry.classification === "ARTICLE_TARGET_NOT_MIGRATED");
  return candidates.length > 0 ? candidates[0] : null;
}
