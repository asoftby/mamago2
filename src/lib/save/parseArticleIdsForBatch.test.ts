/**
 * Unit tests for the Article batch save-status input validation:
 * dedup, cap at MAX_ARTICLE_IDS_PER_BATCH, reject non-string/empty entries.
 * Run: npx tsx src/lib/save/parseArticleIdsForBatch.test.ts
 */
import assert from "node:assert/strict";
import { MAX_ARTICLE_IDS_PER_BATCH, parseArticleIdsForBatch } from "./parseArticleIdsForBatch";

function testRejectsNonArray() {
  assert.deepEqual(parseArticleIdsForBatch(undefined), []);
  assert.deepEqual(parseArticleIdsForBatch(null), []);
  assert.deepEqual(parseArticleIdsForBatch("a1"), []);
  assert.deepEqual(parseArticleIdsForBatch({ articleIds: ["a1"] }), []);
}

function testFiltersInvalidEntries() {
  const result = parseArticleIdsForBatch(["a1", "", 123, null, undefined, {}, "a2"]);
  assert.deepEqual(result, ["a1", "a2"]);
}

function testDedupes() {
  const result = parseArticleIdsForBatch(["a1", "a2", "a1", "a1", "a3", "a2"]);
  assert.deepEqual(result, ["a1", "a2", "a3"]);
}

function testCapsAtMax() {
  const ids = Array.from({ length: MAX_ARTICLE_IDS_PER_BATCH + 15 }, (_, i) => `a${i}`);
  const result = parseArticleIdsForBatch(ids);
  assert.equal(result.length, MAX_ARTICLE_IDS_PER_BATCH);
  assert.deepEqual(result, ids.slice(0, MAX_ARTICLE_IDS_PER_BATCH));
}

function testCustomMax() {
  const result = parseArticleIdsForBatch(["a1", "a2", "a3", "a4"], 2);
  assert.deepEqual(result, ["a1", "a2"]);
}

function testEmptyArray() {
  assert.deepEqual(parseArticleIdsForBatch([]), []);
}

function main() {
  testRejectsNonArray();
  testFiltersInvalidEntries();
  testDedupes();
  testCapsAtMax();
  testCustomMax();
  testEmptyArray();
  console.log("parseArticleIdsForBatch tests: OK");
}

main();
