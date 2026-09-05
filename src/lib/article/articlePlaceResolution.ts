import {
  DEFAULT_ARTICLE_PLACE_SECTIONS,
  type ArticleBlockMvp,
} from "@/lib/publications/articleMvp";
import type {
  ResolvedArticlePlace,
  ResolvedArticlePlaceCard,
} from "@/lib/place/articlePlaceLiveData";

export function collectArticlePlaceIds(blocks: ArticleBlockMvp[]): string[] {
  return [...new Set(blocks.flatMap((block) => {
    if (block.type !== "activityCard" || block.entityType !== "PLACE") return [];
    const id = block.entityId.trim();
    return id ? [id] : [];
  }))];
}

export function resolveArticlePlaceCard(
  block: Extract<ArticleBlockMvp, { type: "activityCard" }>,
  placesById: Map<string, ResolvedArticlePlace>,
): ResolvedArticlePlaceCard | null {
  if (block.entityType !== "PLACE") return null;
  const place = placesById.get(block.entityId.trim());
  return place
    ? { kind: "place-live", place, sections: block.placeSections ?? { ...DEFAULT_ARTICLE_PLACE_SECTIONS } }
    : null;
}
