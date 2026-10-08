import assert from "node:assert/strict";
import { MAIN_ARTICLE_GALLERY_BLOCK_ID, detachLegacyArticleMainGallery, hydrateArticleMainGallery, normalizeCanonicalArticleMainGallery, persistArticleMainGallery, uniqueMediaIdsPreserveOrder } from "./articleMainGallery";
import type { ArticleContentPayload } from "@/lib/publications/articleMvp";

const content = (blocks: ArticleContentPayload["blocks"]): ArticleContentPayload => ({ version: 1, blocks });
const gallery = (id: string, mediaIds: string[]) => ({ id, type: "gallery" as const, mediaIds, presentation: "carousel" as const });

assert.deepEqual(uniqueMediaIdsPreserveOrder([" A ", "", "A", null, "B", " B ", "C"]), ["A", "B", "C"]);
assert.deepEqual(hydrateArticleMainGallery({ coverImageId: "A", content: content([gallery(MAIN_ARTICLE_GALLERY_BLOCK_ID, ["B", "C"])]) }).mediaIds, ["A", "B", "C"]);
assert.deepEqual(hydrateArticleMainGallery({ coverImageId: "A", content: content([gallery(MAIN_ARTICLE_GALLERY_BLOCK_ID, ["A", "B", "C"])]) }).mediaIds, ["A", "B", "C"]);
assert.deepEqual(hydrateArticleMainGallery({ coverImageId: "A", content: content([]) }).mediaIds, ["A"]);

assert.equal(persistArticleMainGallery({ mediaIds: ["A", "B"], inlineContent: content([]) }).coverImageId, "A");
assert.equal(persistArticleMainGallery({ mediaIds: ["B", "A"], inlineContent: content([]) }).coverImageId, "B");
assert.equal(persistArticleMainGallery({ mediaIds: ["B"], inlineContent: content([]) }).coverImageId, "B");
assert.equal(normalizeCanonicalArticleMainGallery({ coverImageId: "A", content: content([gallery(MAIN_ARTICLE_GALLERY_BLOCK_ID, ["B", "A"])]) }).coverImageId, "B");
const empty = persistArticleMainGallery({ mediaIds: [], inlineContent: content([]) });
assert.equal(empty.coverImageId, null);
assert.equal(empty.content.blocks.length, 0);

const routeBlocks = [
  { id: "legacy-route-7-stop-1-heading", type: "heading" as const, level: 2 as const, text: "One" },
  gallery("legacy-route-7-stop-1-image", ["A", "B"]),
  { id: "legacy-route-7-stop-2-heading", type: "heading" as const, level: 2 as const, text: "Two" },
  gallery("legacy-route-7-stop-2-image", ["C", "D"]),
];
const route = hydrateArticleMainGallery({ coverImageId: "COVER", content: content(routeBlocks) });
assert.deepEqual(route.mediaIds, ["COVER"]);
assert.deepEqual(route.inlineContent.blocks, routeBlocks);


const inlineGallery = gallery("inline-gallery", ["INLINE-A", "INLINE-B"]);
const detached = detachLegacyArticleMainGallery({
  coverImageId: "COVER",
  content: content([
    gallery(MAIN_ARTICLE_GALLERY_BLOCK_ID, ["COVER", "OLD-EXTRA"]),
    inlineGallery,
  ]),
});
assert.equal(detached.coverImageId, "COVER");
assert.deepEqual(detached.content.blocks, [inlineGallery], "only the legacy editor gallery is removed");

const recoveredCover = detachLegacyArticleMainGallery({
  coverImageId: null,
  content: content([gallery(MAIN_ARTICLE_GALLERY_BLOCK_ID, ["LEGACY-COVER", "OLD-EXTRA"])]),
});
assert.equal(recoveredCover.coverImageId, "LEGACY-COVER");
assert.equal(recoveredCover.content.blocks.length, 0);

const ordinaryTopGallery = detachLegacyArticleMainGallery({
  coverImageId: "COVER",
  content: content([inlineGallery]),
});
assert.equal(ordinaryTopGallery.coverImageId, "COVER");
assert.deepEqual(ordinaryTopGallery.content.blocks, [inlineGallery], "ordinary inline galleries stay untouched");
