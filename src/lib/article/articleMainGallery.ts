import type { ArticleBlockMvp, ArticleContentPayload } from "@/lib/publications/articleMvp";

/** Stable contentJson identity for the editor-level article gallery. */
export const MAIN_ARTICLE_GALLERY_BLOCK_ID = "article-main-gallery";

export function uniqueMediaIdsPreserveOrder(ids: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of ids) {
    const id = value?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function canonicalGalleryIndex(blocks: readonly ArticleBlockMvp[]): number {
  const explicit = blocks.findIndex(
    (block) => block.type === "gallery" && block.id === MAIN_ARTICLE_GALLERY_BLOCK_ID,
  );
  if (explicit >= 0) return explicit;

  // Backward-compatible adoption is deliberately narrow: only a gallery already
  // at the top of an article can be the old main gallery. Route-stop galleries
  // and every later gallery keep their editorial position as inline content.
  const first = blocks[0];
  return first?.type === "gallery" && !first.id.startsWith("legacy-route-") ? 0 : -1;
}

export function hydrateArticleMainGallery(input: {
  coverImageId?: string | null;
  content: ArticleContentPayload;
}): { mediaIds: string[]; inlineContent: ArticleContentPayload } {
  const index = canonicalGalleryIndex(input.content.blocks);
  const gallery = index >= 0 ? input.content.blocks[index] : null;
  const galleryIds = gallery?.type === "gallery" ? gallery.mediaIds : [];
  return {
    mediaIds: uniqueMediaIdsPreserveOrder([input.coverImageId, ...galleryIds]),
    inlineContent: {
      ...input.content,
      blocks: index >= 0 ? input.content.blocks.filter((_, blockIndex) => blockIndex !== index) : input.content.blocks,
    },
  };
}

export function persistArticleMainGallery(input: {
  mediaIds: readonly string[];
  inlineContent: ArticleContentPayload;
}): { coverImageId: string | null; content: ArticleContentPayload } {
  const mediaIds = uniqueMediaIdsPreserveOrder(input.mediaIds);
  const inlineBlocks = input.inlineContent.blocks.filter(
    (block) => !(block.type === "gallery" && block.id === MAIN_ARTICLE_GALLERY_BLOCK_ID),
  );
  return {
    coverImageId: mediaIds[0] ?? null,
    content: {
      ...input.inlineContent,
      blocks: mediaIds.length
        ? [{ id: MAIN_ARTICLE_GALLERY_BLOCK_ID, type: "gallery", mediaIds, presentation: "carousel" }, ...inlineBlocks]
        : inlineBlocks,
    },
  };
}

export function normalizeCanonicalArticleMainGallery(input: {
  coverImageId?: string | null;
  content: ArticleContentPayload;
}): { coverImageId: string | null; content: ArticleContentPayload } {
  const explicit = input.content.blocks.some(
    (block) => block.type === "gallery" && block.id === MAIN_ARTICLE_GALLERY_BLOCK_ID,
  );
  if (!explicit) return { coverImageId: input.coverImageId?.trim() || null, content: input.content };
  const block = input.content.blocks.find(
    (candidate): candidate is Extract<ArticleBlockMvp, { type: "gallery" }> =>
      candidate.type === "gallery" && candidate.id === MAIN_ARTICLE_GALLERY_BLOCK_ID,
  )!;
  return persistArticleMainGallery({
    mediaIds: block.mediaIds,
    inlineContent: {
      ...input.content,
      blocks: input.content.blocks.filter((candidate) => candidate !== block),
    },
  });
}


/**
 * Transitional cleanup for articles saved while the editor-level main gallery existed.
 * Only the explicit service block is removed; ordinary inline galleries are preserved.
 */
export function detachLegacyArticleMainGallery(input: {
  coverImageId?: string | null;
  content: ArticleContentPayload;
}): { coverImageId: string | null; content: ArticleContentPayload } {
  const legacyBlock = input.content.blocks.find(
    (block): block is Extract<ArticleBlockMvp, { type: "gallery" }> =>
      block.type === "gallery" && block.id === MAIN_ARTICLE_GALLERY_BLOCK_ID,
  );
  const explicitCover = input.coverImageId?.trim() || null;
  const legacyCover = legacyBlock?.mediaIds.find((id) => id.trim())?.trim() || null;

  return {
    coverImageId: explicitCover ?? legacyCover,
    content: legacyBlock
      ? {
          ...input.content,
          blocks: input.content.blocks.filter((block) => block !== legacyBlock),
        }
      : input.content,
  };
}
