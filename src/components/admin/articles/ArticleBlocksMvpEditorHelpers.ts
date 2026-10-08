import type { ArticleBlockMvp } from "@/lib/publications/articleMvp";

/** `image` -> `gallery`, same block id and MediaAsset id: no file copy/re-upload. */
export function convertImageBlockToGallery(block: Extract<ArticleBlockMvp, { type: "image" }>): ArticleBlockMvp {
  return {
    id: block.id,
    type: "gallery",
    mediaIds: block.mediaId ? [block.mediaId] : [],
    presentation: "carousel",
    caption: block.caption,
  };
}

/** Two adjacent `image` blocks -> one `gallery` at the first block position, preserving A,B order. */
export function mergeImageBlocksIntoGallery(
  a: Extract<ArticleBlockMvp, { type: "image" }>,
  b: Extract<ArticleBlockMvp, { type: "image" }>,
): ArticleBlockMvp {
  return {
    id: a.id,
    type: "gallery",
    mediaIds: [a.mediaId, b.mediaId].filter((id): id is string => Boolean(id)),
    presentation: "carousel",
    caption: a.caption || b.caption,
  };
}
