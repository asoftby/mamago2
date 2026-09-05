/**
 * Unit tests for extractArticleMediaUsage / extractArticleMediaIds — the
 * shared "which MediaAsset ids does this Article reference" helper used by
 * both /api/admin/articles/[id]/media (persisted articles) and the client
 * draft-derivation path for unsaved articles (see useArticleMediaSource).
 *
 * Run: npx tsx src/lib/publications/articleMvp.test.ts
 */
import assert from "node:assert/strict";
import { ArticleContentPayloadSchema, extractArticleMediaIds, extractArticleMediaUsage, newBlock, prepareArticleContentForSave, serializeArticleContent, type ArticleBlockMvp } from "./articleMvp";

// newBlock()'s return type is the full ArticleBlockMvp union (not narrowed to
// the requested variant), so spreading it and overriding mediaId/mediaIds
// doesn't typecheck — build the image/gallery variants directly instead.
function imageBlock(mediaId: string): ArticleBlockMvp {
  return { id: "img-block", type: "image", mediaId, alt: "", caption: "" };
}

{
  const content = { version: 1 as const, blocks: [{ id: "price", type: "price" as const, data: { mode: "FREE" as const, currency: " BYN ", min: 0, max: 0, items: [{ id: "blank", label: " ", price: "", unit: "BYN" }, { id: "adult", label: " Adult ", price: " 20 ", unit: " BYN " }], note: " note " } }] };
  const prepared = prepareArticleContentForSave(content);
  assert.deepEqual(prepared.blocks[0]?.type === "price" ? prepared.blocks[0].data.items : [], [{ id: "adult", label: "Adult", price: "20", unit: "BYN" }]);
  assert.equal(ArticleContentPayloadSchema.safeParse(prepareArticleContentForSave({ ...content, blocks: [{ ...content.blocks[0], data: { ...content.blocks[0].data, items: [{ id: "partial", label: "Adult", price: "", unit: "BYN" }] } }] })).success, false);
  assert.equal(ArticleContentPayloadSchema.safeParse(prepareArticleContentForSave({ ...content, blocks: [{ ...content.blocks[0], data: { ...content.blocks[0].data, items: [{ id: "partial", label: "", price: "20", unit: "BYN" }] } }] })).success, false);
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

// Phase 4 is additive to content version 1: old and structured blocks share the
// authoritative union and survive a JSON persistence roundtrip without loss.
{
  const payload = {
    version: 1 as const,
    blocks: [
      { id: "old", type: "text" as const, text: "Existing article" },
      { id: "contacts", type: "contacts" as const, data: { address: "Минск", phones: [{ value: "+375291112233" }], socials: [{ kind: "telegram" as const, url: "https://t.me/mamago" }] } },
      { id: "price", type: "price" as const, data: { mode: "RANGE" as const, currency: "BYN", min: 10, max: 20, items: [{ id: "child", label: "Детский", price: "10", unit: "BYN" }], note: "" } },
      { id: "hours", type: "openingHours" as const, data: { mode: "WEEKLY" as const, timezone: "Europe/Minsk", rules: [{ dayOfWeek: "MON" as const, isOpen: true, allDay: false, intervals: [{ startTime: "10:00", endTime: "18:00" }] }], exceptions: [{ date: "2028-02-29", isClosed: true, allDay: false, intervals: [] }] } },
    ],
  };
  const parsed = ArticleContentPayloadSchema.parse(payload);
  assert.deepEqual(ArticleContentPayloadSchema.parse(serializeArticleContent(parsed)), parsed);
  assert.equal(parsed.version, 1, "additive union does not rewrite existing content version");
  assert.equal(ArticleContentPayloadSchema.safeParse({ ...payload, blocks: [{ id: "bad", type: "contacts", data: { phones: [], socials: [], email: "bad" } }] }).success, false);
  assert.equal(ArticleContentPayloadSchema.safeParse({ ...payload, blocks: [{ id: "bad", type: "openingHours", data: { mode: "WEEKLY", timezone: "Mars/Olympus", rules: [], exceptions: [] } }] }).success, false);
}
