/**
 * Unit tests for the image→gallery block-conversion helpers used by
 * ArticleBlocksMvpEditor's "Сделать галереей" / "Объединить в галерею"
 * actions (ticket §7, §11). Pure functions — no MediaAsset is created,
 * copied, or re-uploaded; only contentJson block shape changes.
 *
 * Run: npx tsx src/components/admin/articles/ArticleBlocksMvpEditor.test.ts
 */
import assert from "node:assert/strict";
import type { ArticleBlockMvp } from "@/lib/publications/articleMvp";
import { convertImageBlockToGallery, mergeImageBlocksIntoGallery } from "./ArticleBlocksMvpEditor";

function image(overrides: Partial<Extract<ArticleBlockMvp, { type: "image" }>> = {}): Extract<
  ArticleBlockMvp,
  { type: "image" }
> {
  return { id: "b1", type: "image", mediaId: "media-a", alt: "", caption: "", ...overrides };
}

// Scenario B from the ticket: Image [A] → "Сделать галереей" → Gallery [A].
// Same media id, same block id, no new MediaAsset involved (this function
// never touches Prisma/MediaAsset at all — it's a pure contentJson mapper).
{
  const gallery = convertImageBlockToGallery(image({ id: "img-1", mediaId: "media-a", caption: "Caption A" }));
  assert.equal(gallery.type, "gallery");
  assert.equal(gallery.id, "img-1", "block id is preserved (not regenerated)");
  if (gallery.type === "gallery") {
    assert.deepEqual(gallery.mediaIds, ["media-a"], "the current image becomes the gallery's first (only) item");
    assert.equal(gallery.caption, "Caption A", "caption carries over — best-effort, no data loss");
    assert.equal(gallery.presentation, "carousel");
  }
}

// An image block with no mediaId yet (freshly inserted, nothing picked) still
// converts cleanly to an empty gallery rather than throwing or filling with
// a bogus empty-string id.
{
  const gallery = convertImageBlockToGallery(image({ mediaId: "" }));
  assert.equal(gallery.type, "gallery");
  if (gallery.type === "gallery") {
    assert.deepEqual(gallery.mediaIds, []);
  }
}

// §11: two adjacent image blocks A, B → one gallery [A, B] at A's position,
// order preserved, both original block ids collapse into A's.
{
  const a = image({ id: "img-a", mediaId: "media-a", caption: "" });
  const b = image({ id: "img-b", mediaId: "media-b", caption: "Caption B" });
  const merged = mergeImageBlocksIntoGallery(a, b);
  assert.equal(merged.type, "gallery");
  assert.equal(merged.id, "img-a", "merged block takes the first block's id (replaces it in place)");
  if (merged.type === "gallery") {
    assert.deepEqual(merged.mediaIds, ["media-a", "media-b"], "order A, B must be preserved");
    assert.equal(merged.caption, "Caption B", "falls back to B's caption when A's is empty");
  }
}

// Merge never drops an id just because one side has no mediaId yet.
{
  const a = image({ id: "img-a", mediaId: "" });
  const b = image({ id: "img-b", mediaId: "media-b" });
  const merged = mergeImageBlocksIntoGallery(a, b);
  if (merged.type === "gallery") {
    assert.deepEqual(merged.mediaIds, ["media-b"]);
  }
}

console.log("ArticleBlocksMvpEditor.test.ts (image/gallery conversion helpers): OK");
