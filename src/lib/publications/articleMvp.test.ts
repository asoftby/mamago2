/**
 * Unit tests for extractArticleMediaUsage / extractArticleMediaIds — the
 * shared "which MediaAsset ids does this Article reference" helper used by
 * both /api/admin/articles/[id]/media (persisted articles) and the client
 * draft-derivation path for unsaved articles (see useArticleMediaSource).
 *
 * Run: npx tsx src/lib/publications/articleMvp.test.ts
 */
import assert from "node:assert/strict";
import { extractArticleMediaIds, extractArticleMediaUsage, newBlock, type ArticleBlockMvp } from "./articleMvp";

// newBlock()'s return type is the full ArticleBlockMvp union (not narrowed to
// the requested variant), so spreading it and overriding mediaId/mediaIds
// doesn't typecheck — build the image/gallery variants directly instead.
function imageBlock(mediaId: string): ArticleBlockMvp {
  return { id: "img-block", type: "image", mediaId, alt: "", caption: "" };
}

function galleryBlock(mediaIds: string[]): ArticleBlockMvp {
  return { id: "gallery-block", type: "gallery", mediaIds, presentation: "carousel", caption: "" };
}

// Cover + seo + image block + gallery block, all distinct ids, in the
// expected order (cover, seo, then blocks in array order).
{
  const entries = extractArticleMediaUsage({
    coverImageId: "cover-1",
    seoImageId: "seo-1",
    blocks: [imageBlock("image-1"), galleryBlock(["gallery-1", "gallery-2"])],
  });
  assert.deepEqual(
    entries.map((e) => e.mediaId),
    ["cover-1", "seo-1", "image-1", "gallery-1", "gallery-2"],
    "must return every referenced id, cover/seo first, then blocks in order",
  );
  assert.deepEqual(entries.find((e) => e.mediaId === "cover-1")?.usage, ["cover"]);
  assert.deepEqual(entries.find((e) => e.mediaId === "seo-1")?.usage, ["seo"]);
  assert.deepEqual(entries.find((e) => e.mediaId === "image-1")?.usage, ["image-block"]);
  assert.deepEqual(entries.find((e) => e.mediaId === "gallery-1")?.usage, ["gallery-block"]);
}

// Dedup: the same MediaAsset used as cover AND inside an image block collapses
// into a single entry whose usage lists both places.
{
  const entries = extractArticleMediaUsage({
    coverImageId: "shared-1",
    blocks: [imageBlock("shared-1")],
  });
  assert.equal(entries.length, 1, "same id in two places must collapse to one entry");
  assert.deepEqual(entries[0].usage, ["cover", "image-block"]);
}

// Dedup: same id appearing twice inside one gallery's mediaIds still yields
// a single usage entry (no duplicate "gallery-block" repeated meaninglessly,
// no duplicate entry in the list).
{
  const entries = extractArticleMediaUsage({ blocks: [galleryBlock(["dup-1", "dup-1"])] });
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].usage, ["gallery-block"]);
}

// Owner-agnostic by construction: the function never looks at uploadedById —
// it has no such parameter — so migrated/legacy media referenced anywhere in
// the article is included regardless of who historically owns the file.
{
  const entries = extractArticleMediaUsage({
    coverImageId: "migrated-asset",
    blocks: [],
  });
  assert.deepEqual(entries.map((e) => e.mediaId), ["migrated-asset"]);
}

// Non-image/gallery blocks (text, quote, heading, activityCard, embed, intro)
// never contribute ids.
{
  const entries = extractArticleMediaUsage({
    blocks: [newBlock("intro"), newBlock("text"), newBlock("quote"), newBlock("heading"), newBlock("embed")],
  });
  assert.deepEqual(entries, []);
}

// Missing/empty/whitespace-only ids are skipped, never surfaced as entries.
{
  const entries = extractArticleMediaUsage({
    coverImageId: "  ",
    seoImageId: null,
    blocks: [imageBlock(""), galleryBlock(["", "  ", "real-1"])],
  });
  assert.deepEqual(entries.map((e) => e.mediaId), ["real-1"]);
}

// No input at all → empty result, never throws.
{
  assert.deepEqual(extractArticleMediaUsage({}), []);
  assert.deepEqual(extractArticleMediaIds({}), []);
}

// extractArticleMediaIds is the usage-stripped id list, same order/dedup.
{
  const ids = extractArticleMediaIds({
    coverImageId: "a",
    blocks: [imageBlock("a"), imageBlock("b"), galleryBlock(["b", "c"])],
  });
  assert.deepEqual(ids, ["a", "b", "c"]);
}

console.log("articleMvp.test.ts (extractArticleMediaUsage/extractArticleMediaIds): OK");
