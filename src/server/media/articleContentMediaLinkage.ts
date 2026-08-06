import { parseArticleContentJson } from "@/lib/publications/articleMvp";

/**
 * True if a MediaAsset id is referenced by an `image`/`gallery` block inside
 * `Article.contentJson.blocks`. Single source of truth for the block-shape
 * contract (`image.mediaId`, `gallery.mediaIds`) — see `articleMvp.ts`.
 * No `server-only`/prisma import here so it stays unit-testable via tsx.
 */
export function articleContentBlocksReferenceMediaId(
  contentJson: unknown,
  mediaId: string,
): boolean {
  const { blocks } = parseArticleContentJson(contentJson);
  return blocks.some((block) => {
    if (block.type === "image") {
      return block.mediaId === mediaId;
    }
    if (block.type === "gallery") {
      return block.mediaIds.includes(mediaId);
    }
    return false;
  });
}
