import assert from "node:assert/strict";
import test from "node:test";
import { buildJournalFeedBuckets, journalBlockWheres, showJournalTopBlocks } from "./journalPageQueries";

const rubric = { categoryId: "rubric-1" };

test("all blocks are filtered by the selected rubric", () => {
  const w = journalBlockWheres({ scopeWhere: rubric, typeFilter: null, mainId: "main-1" });
  for (const where of [w.main, w.news, w.collections, w.feed]) {
    assert.deepEqual((where as { AND: unknown[] }).AND[0], rubric);
  }
});

test("main = featured of any type; news/collections by type", () => {
  const w = journalBlockWheres({ scopeWhere: null, typeFilter: null, mainId: null });
  assert.deepEqual(w.main, { featured: true });
  assert.deepEqual(w.news, { publicationType: "BREAKING_NEWS" });
  assert.deepEqual(w.collections, { publicationType: "COLLECTION" });
  assert.deepEqual(w.feed, {}, "feed keeps every type (news and collections stay in the feed)");
});

test("main material is not duplicated in the feed", () => {
  const w = journalBlockWheres({ scopeWhere: null, typeFilter: null, mainId: "main-1" });
  assert.deepEqual(w.feed, { AND: [{ id: { not: "main-1" } }] });
});

test("type filter (?type=) narrows only the feed", () => {
  const w = journalBlockWheres({ scopeWhere: null, typeFilter: "COLLECTION", mainId: null });
  assert.deepEqual(w.feed, { AND: [{ publicationType: "COLLECTION" }] });
});

test("top blocks only on the first unfiltered page", () => {
  assert.equal(showJournalTopBlocks(1, null), true);
  assert.equal(showJournalTopBlocks(2, null), false);
  assert.equal(showJournalTopBlocks(1, "BREAKING_NEWS"), false);
});

test("feed buckets: pinned first, then city relevance; no city → single bucket", () => {
  const city = { id: "minsk", slug: "minsk", regionId: "minsk-region" };
  const buckets = buildJournalFeedBuckets(city, { pinnedFirst: true });
  assert.deepEqual(buckets[0], { group: null, where: { pinned: true } });
  assert.equal(buckets[1].group, "CITY");
  assert.deepEqual((buckets[1].where as { AND: unknown[] }).AND[1], { pinned: false });
  assert.equal(buckets.length, 5);
  assert.deepEqual(buildJournalFeedBuckets(null), [{ group: null, where: {} }]);
  assert.equal(buildJournalFeedBuckets(city).length, 4, "without pinnedFirst the order is geography only");
});
