import assert from "node:assert/strict";

import { parsePlaceMediaAttachmentIds } from "./parsePlaceMediaAttachmentIds";

function testUndefinedInput() {
  const result = parsePlaceMediaAttachmentIds(undefined);
  assert.deepEqual(result.ids, []);
  assert.deepEqual(result.invalidTokens, []);
}

function testEmptyArrayInput() {
  const result = parsePlaceMediaAttachmentIds([]);
  assert.deepEqual(result.ids, []);
  assert.deepEqual(result.invalidTokens, []);
}

function testCommaSeparatedScalarInOneRow() {
  // The real shape of Place `gallery` — one postmeta row, comma-joined ids.
  const result = parsePlaceMediaAttachmentIds(["5391,5392,5393"]);
  assert.deepEqual(result.ids, [5391, 5392, 5393]);
  assert.deepEqual(result.invalidTokens, []);
}

function testSingleId() {
  const result = parsePlaceMediaAttachmentIds(["5406"]);
  assert.deepEqual(result.ids, [5406]);
}

function testMultipleSeparateRowsEachOneId() {
  // The shape other entities (Route/Event/Offer) use — one id per row.
  const result = parsePlaceMediaAttachmentIds(["111", "222", "333"]);
  assert.deepEqual(result.ids, [111, 222, 333]);
}

function testMixedWhitespace() {
  const result = parsePlaceMediaAttachmentIds(["  5391 , 5392,5393  ", " 5394 "]);
  assert.deepEqual(result.ids, [5391, 5392, 5393, 5394]);
}

function testExactDuplicatesDedupedFirstOccurrenceOrderPreserved() {
  const result = parsePlaceMediaAttachmentIds(["100,200,100", "300,200"]);
  assert.deepEqual(result.ids, [100, 200, 300], "first occurrence position is kept, later repeats dropped");
}

function testInvalidNonNumericTokenReportedNotCrashing() {
  const result = parsePlaceMediaAttachmentIds(["100,abc,200"]);
  assert.deepEqual(result.ids, [100, 200]);
  assert.deepEqual(result.invalidTokens, ["abc"]);
}

function testNegativeTokenRejected() {
  const result = parsePlaceMediaAttachmentIds(["100,-5,200"]);
  assert.deepEqual(result.ids, [100, 200]);
  assert.deepEqual(result.invalidTokens, ["-5"]);
}

function testZeroTokenRejected() {
  const result = parsePlaceMediaAttachmentIds(["100,0,200"]);
  assert.deepEqual(result.ids, [100, 200]);
  assert.deepEqual(result.invalidTokens, ["0"]);
}

function testEmptyTokensBetweenCommasSkippedSilently() {
  // "100,,200" and a trailing comma are not malformed data on their own —
  // just nothing to report for the empty slot.
  const result = parsePlaceMediaAttachmentIds(["100,,200,"]);
  assert.deepEqual(result.ids, [100, 200]);
  assert.deepEqual(result.invalidTokens, []);
}

function testDecimalTokenRejected() {
  const result = parsePlaceMediaAttachmentIds(["100.5"]);
  assert.deepEqual(result.ids, []);
  assert.deepEqual(result.invalidTokens, ["100.5"]);
}

function testLeadingPlusSignRejected() {
  const result = parsePlaceMediaAttachmentIds(["+100"]);
  assert.deepEqual(result.ids, []);
  assert.deepEqual(result.invalidTokens, ["+100"]);
}

function testInvalidTokensAcrossMultipleRowsAllReported() {
  const result = parsePlaceMediaAttachmentIds(["abc", "100", "xyz"]);
  assert.deepEqual(result.ids, [100]);
  assert.deepEqual(result.invalidTokens, ["abc", "xyz"]);
}

function testGoldenPlace5389Gallery() {
  const result = parsePlaceMediaAttachmentIds([
    "5391,5392,5393,5394,5395,5396,5397,5398,5399,5400,5401,5402,5403,5404",
  ]);
  assert.equal(result.ids.length, 14);
  assert.equal(result.ids[0], 5391);
  assert.equal(result.ids[13], 5404);
  assert.deepEqual(result.invalidTokens, []);
}

function testGoldenPlace43023GalleryContainsIdSharedWithCover() {
  // Real source data: 43025 appears both as this place's `cover` value and
  // inside its `gallery` list — a genuine cross-field overlap, not a
  // same-field duplicate. The gallery parse on its own must keep it
  // (parsePlaceMediaAttachmentIds only dedupes within the same call).
  const result = parsePlaceMediaAttachmentIds([
    "43026,43027,43028,43029,43030,43025,43031,43032,43033,43034,43035",
  ]);
  assert.equal(result.ids.length, 11);
  assert.ok(result.ids.includes(43025));
}

function testDeterministicOutputAcrossRepeatedCalls() {
  const input = ["100,abc,200,100"];
  const first = parsePlaceMediaAttachmentIds(input);
  const second = parsePlaceMediaAttachmentIds(input);
  assert.deepEqual(first, second);
}

function main() {
  testUndefinedInput();
  testEmptyArrayInput();
  testCommaSeparatedScalarInOneRow();
  testSingleId();
  testMultipleSeparateRowsEachOneId();
  testMixedWhitespace();
  testExactDuplicatesDedupedFirstOccurrenceOrderPreserved();
  testInvalidNonNumericTokenReportedNotCrashing();
  testNegativeTokenRejected();
  testZeroTokenRejected();
  testEmptyTokensBetweenCommasSkippedSilently();
  testDecimalTokenRejected();
  testLeadingPlusSignRejected();
  testInvalidTokensAcrossMultipleRowsAllReported();
  testGoldenPlace5389Gallery();
  testGoldenPlace43023GalleryContainsIdSharedWithCover();
  testDeterministicOutputAcrossRepeatedCalls();
  console.log("parsePlaceMediaAttachmentIds tests: OK");
}

main();
