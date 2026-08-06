/** Run: tsx src/lib/publications/articleContentMedia.test.ts (assert-based, project convention). */
import assert from "node:assert/strict";

import { extractArticleContentMediaIds } from "./articleContentMedia";
import type { ArticleContentPayload } from "./articleMvp";

function payload(blocks: ArticleContentPayload["blocks"]): ArticleContentPayload {
  return { version: 1, blocks };
}

function testEmptyContentReturnsEmpty() {
  assert.deepEqual(extractArticleContentMediaIds(payload([])), []);
}

function testSingleImageBlock() {
  const result = extractArticleContentMediaIds(
    payload([{ id: "b1", type: "image", mediaId: "media-1" }]),
  );
  assert.deepEqual(result, ["media-1"]);
}

function testGalleryBlock() {
  const result = extractArticleContentMediaIds(
    payload([{ id: "b1", type: "gallery", mediaIds: ["media-1", "media-2"] }]),
  );
  assert.deepEqual(result, ["media-1", "media-2"]);
}

function testImageAndGalleryCombined() {
  const result = extractArticleContentMediaIds(
    payload([
      { id: "b1", type: "intro", text: "intro" },
      { id: "b2", type: "image", mediaId: "media-1" },
      { id: "b3", type: "text", text: "middle" },
      { id: "b4", type: "gallery", mediaIds: ["media-2", "media-3"] },
    ]),
  );
  assert.deepEqual(result, ["media-1", "media-2", "media-3"]);
}

function testDuplicateMediaIdsAreDeduped() {
  const result = extractArticleContentMediaIds(
    payload([
      { id: "b1", type: "image", mediaId: "media-1" },
      { id: "b2", type: "gallery", mediaIds: ["media-1", "media-2", "media-2"] },
      { id: "b3", type: "image", mediaId: "media-2" },
    ]),
  );
  assert.deepEqual(result, ["media-1", "media-2"]);
}

function testEmptyAndWhitespaceIdsAreIgnored() {
  const result = extractArticleContentMediaIds(
    payload([
      { id: "b1", type: "image", mediaId: "" },
      { id: "b2", type: "image", mediaId: "   " },
      { id: "b3", type: "gallery", mediaIds: ["", "  ", "media-1"] },
    ]),
  );
  assert.deepEqual(result, ["media-1"]);
}

function testInvalidPayloadFailsClosed() {
  assert.deepEqual(extractArticleContentMediaIds(null), []);
  assert.deepEqual(extractArticleContentMediaIds(undefined), []);
  assert.deepEqual(extractArticleContentMediaIds("not an object"), []);
  assert.deepEqual(extractArticleContentMediaIds({ version: 1 }), [], "missing blocks array");
  assert.deepEqual(extractArticleContentMediaIds({ version: 2, blocks: [] }), [], "wrong version literal");
  assert.deepEqual(
    extractArticleContentMediaIds({ version: 1, blocks: [{ id: "b1", type: "image" }] }),
    [],
    "block fails its own schema (missing mediaId) invalidates the whole payload",
  );
}

function testOrderIsFirstOccurrenceDeterministic() {
  const result = extractArticleContentMediaIds(
    payload([
      { id: "b1", type: "gallery", mediaIds: ["media-3", "media-1"] },
      { id: "b2", type: "image", mediaId: "media-2" },
      { id: "b3", type: "image", mediaId: "media-1" },
    ]),
  );
  assert.deepEqual(result, ["media-3", "media-1", "media-2"]);
}

function testCoverAndSeoImageIdsAreNeverIncluded() {
  // extractArticleContentMediaIds only ever sees contentJson — coverImageId/
  // seoImageId are separate Article columns and structurally cannot appear
  // here, but this pins that a mediaId that happens to equal one used
  // elsewhere is still only counted once, from the block itself.
  const result = extractArticleContentMediaIds(
    payload([{ id: "b1", type: "image", mediaId: "same-id-as-cover" }]),
  );
  assert.deepEqual(result, ["same-id-as-cover"]);
}

function testTrimsWhitespaceAroundIds() {
  const result = extractArticleContentMediaIds(
    payload([{ id: "b1", type: "image", mediaId: "  media-1  " }]),
  );
  assert.deepEqual(result, ["media-1"]);
}

function main() {
  testEmptyContentReturnsEmpty();
  testSingleImageBlock();
  testGalleryBlock();
  testImageAndGalleryCombined();
  testDuplicateMediaIdsAreDeduped();
  testEmptyAndWhitespaceIdsAreIgnored();
  testInvalidPayloadFailsClosed();
  testOrderIsFirstOccurrenceDeterministic();
  testCoverAndSeoImageIdsAreNeverIncluded();
  testTrimsWhitespaceAroundIds();
  console.log("articleContentMedia tests: OK");
}

main();
