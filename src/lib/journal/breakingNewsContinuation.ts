import type { Prisma } from "@prisma/client";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";

/**
 * Continuous reader must never append expired or future Breaking News.
 * Archived entries remain available through their ordinary public article URL.
 * The legacy subtitle marker is intentionally retained for migrated articles.
 */
export function activeBreakingNewsContinuationWhere(now: Date): Prisma.ArticleWhereInput {
  return {
    subtitle: BREAKING_NEWS_SUBTITLE,
    expiresAt: { gt: now },
    publishedAt: { lte: now },
  };
}

/**
 * Unavailable items (e.g. a story that expired after the metadata response)
 * must be skipped rather than retried forever ahead of newer valid items.
 */
export function nextContinuationItem<T extends { id: string }>(
  items: readonly T[],
  loadedIds: ReadonlySet<string>,
  unavailableIds: ReadonlySet<string>,
): T | null {
  return items.find(item => !loadedIds.has(item.id) && !unavailableIds.has(item.id)) ?? null;
}
