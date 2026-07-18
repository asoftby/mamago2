import assert from "node:assert/strict";

import { normalizeInstagramHandle, shouldShowInstagramAvatarImport } from "./normalizeInstagramHandle";

function testAtPrefixedHandleIsStripped() {
  const result = normalizeInstagramHandle("@mamago.by");
  assert.equal(result.instagramHandle, "mamago.by");
  assert.equal(result.instagramUrl, "https://instagram.com/mamago.by");
}

function testBareHandlePassesThrough() {
  const result = normalizeInstagramHandle("mamago.by");
  assert.equal(result.instagramHandle, "mamago.by");
  assert.equal(result.instagramUrl, "https://instagram.com/mamago.by");
}

function testFullUrlIsNormalizedToHandle() {
  const result = normalizeInstagramHandle("https://instagram.com/mamago.by");
  assert.equal(result.instagramHandle, "mamago.by");
  assert.equal(result.instagramUrl, "https://instagram.com/mamago.by");
}

function testFullUrlWithTrailingSlashAndQuery() {
  const result = normalizeInstagramHandle("https://www.instagram.com/mamago.by/?hl=ru");
  assert.equal(result.instagramHandle, "mamago.by");
}

function testWhitespaceIsTrimmed() {
  const result = normalizeInstagramHandle("  @mamago.by  ");
  assert.equal(result.instagramHandle, "mamago.by");
}

function testEmptyInputYieldsNullUrl() {
  const result = normalizeInstagramHandle("");
  assert.equal(result.instagramHandle, "");
  assert.equal(result.instagramUrl, null);
}

function testFilledHandleAndSessionShowsImport() {
  assert.equal(
    shouldShowInstagramAvatarImport({ instagramHandle: "mamago.by", wizardSessionId: "sess-1" }),
    true,
  );
}

function testEmptyHandleNeverShowsImport() {
  assert.equal(
    shouldShowInstagramAvatarImport({ instagramHandle: "", wizardSessionId: "sess-1" }),
    false,
  );
  assert.equal(
    shouldShowInstagramAvatarImport({ instagramHandle: null, wizardSessionId: "sess-1" }),
    false,
  );
  assert.equal(
    shouldShowInstagramAvatarImport({ instagramHandle: "   ", wizardSessionId: "sess-1" }),
    false,
  );
}

function testMissingSessionNeverShowsImportEvenWithHandle() {
  assert.equal(
    shouldShowInstagramAvatarImport({ instagramHandle: "mamago.by", wizardSessionId: undefined }),
    false,
  );
}

function main() {
  testAtPrefixedHandleIsStripped();
  testBareHandlePassesThrough();
  testFullUrlIsNormalizedToHandle();
  testFullUrlWithTrailingSlashAndQuery();
  testWhitespaceIsTrimmed();
  testEmptyInputYieldsNullUrl();
  testFilledHandleAndSessionShowsImport();
  testEmptyHandleNeverShowsImport();
  testMissingSessionNeverShowsImportEvenWithHandle();
}

main();
console.log("normalizeInstagramHandle tests: OK");
