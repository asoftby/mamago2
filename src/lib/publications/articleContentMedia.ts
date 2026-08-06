import { ArticleContentPayloadSchema } from "./articleMvp";

/**
 * Pure extraction of every `MediaAsset` id an Article's body actually
 * references — `image.mediaId` and `gallery.mediaIds` — deduplicated and in
 * deterministic first-occurrence order. Deliberately excludes
 * `Article.coverImageId`/`seoImageId`: those are direct FK columns already
 * checked by `hasPublishedPublicLinkage()` independently of `MediaUsage`,
 * so including them here would create a second, redundant place that has to
 * stay in sync with the same fact.
 *
 * Fails closed: anything that doesn't parse as a valid
 * `ArticleContentPayload` yields `[]` rather than best-effort scavenging IDs
 * out of unknown/malformed shapes — a caller syncing `MediaUsage` from this
 * output must never invent usage rows for content it couldn't actually
 * validate.
 */
export function extractArticleContentMediaIds(contentJson: unknown): string[] {
  const parsed = ArticleContentPayloadSchema.safeParse(contentJson);
  if (!parsed.success) {
    return [];
  }

  const seen = new Set<string>();
  const ordered: string[] = [];

  const add = (rawId: string) => {
    const id = rawId.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(id);
  };

  for (const block of parsed.data.blocks) {
    if (block.type === "image") {
      add(block.mediaId);
    } else if (block.type === "gallery") {
      for (const mediaId of block.mediaIds) {
        add(mediaId);
      }
    }
  }

  return ordered;
}
