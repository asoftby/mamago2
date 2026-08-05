/**
 * Чистые хелперы подбора следующей статьи в разделе (без Prisma / server-only).
 */
import type { GeoScope, Prisma } from "@prisma/client";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";

export const MAX_NEXT_ARTICLE_EXCLUDE_IDS = 50;

/** Нормализация excludeIds: уникальные, capped, без пустых. */
export function normalizeExcludeIds(
  excludeIds: readonly string[],
  currentArticleId: string,
  max = MAX_NEXT_ARTICLE_EXCLUDE_IDS,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const t = id.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  push(currentArticleId);
  for (const id of excludeIds) {
    if (out.length >= max) break;
    push(id);
  }
  return out;
}

/**
 * Базовый where для публично читаемых статей раздела.
 */
export function buildNextArticleInSectionWhere(args: {
  sectionId: string;
  cityId: string | null;
  geoScope: GeoScope;
  excludeIds: string[];
  now: Date;
}): Prisma.ArticleWhereInput {
  const { sectionId, cityId, geoScope, excludeIds, now } = args;
  return {
    status: "PUBLISHED",
    categoryId: sectionId,
    geoScope,
    cityId: cityId === null ? null : cityId,
    publishedAt: { lte: now },
    slug: { not: null },
    id: { notIn: excludeIds },
    OR: [{ subtitle: null }, { subtitle: { not: BREAKING_NEWS_SUBTITLE } }],
  };
}

export const NEXT_ARTICLE_ORDER_BY: Prisma.ArticleOrderByWithRelationInput[] = [
  { publishedAt: "desc" },
  { id: "desc" },
];
