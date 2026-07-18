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

/**
 * The Contacts step's field and the Photos step's fallback field both call
 * `normalizeInstagramHandle` directly and pass its result straight to the
 * shared `onChange` — no per-step transform of their own. Same input must
 * produce byte-identical output regardless of which one calls it, proving
 * there's exactly one normalization path, never two that could drift.
 */
function testSameInputNormalizesIdenticallyFromEitherEntryPoint() {
  const fromContacts = normalizeInstagramHandle("@atmosphera_minsk");
  const fromPhotos = normalizeInstagramHandle("@atmosphera_minsk");
  assert.deepEqual(fromContacts, fromPhotos);
  assert.deepEqual(fromContacts, { instagramHandle: "atmosphera_minsk", instagramUrl: "https://instagram.com/atmosphera_minsk" });
}

/**
 * Clearing the field (either step) must fully reset both fields — a stray
 * `instagramUrl` surviving an empty handle would make the Photos-step
 * import affordance's visibility check inconsistent with the stored data.
 */
function testClearingResetsBothFieldsAndHidesImport() {
  const cleared = normalizeInstagramHandle("");
  assert.deepEqual(cleared, { instagramHandle: "", instagramUrl: null });
  assert.equal(
    shouldShowInstagramAvatarImport({ instagramHandle: cleared.instagramHandle, wizardSessionId: "sess-1" }),
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
  testSameInputNormalizesIdenticallyFromEitherEntryPoint();
  testClearingResetsBothFieldsAndHidesImport();
}

main();
console.log("normalizeInstagramHandle tests: OK");
