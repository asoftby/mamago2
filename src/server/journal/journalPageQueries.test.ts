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

test("main = featured of any type; news block only non-expired; collections by type", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  const w = journalBlockWheres({ scopeWhere: null, typeFilter: null, mainId: null, now });
  assert.deepEqual(w.main, { featured: true });
  assert.deepEqual(w.news, {
    AND: [
      { publicationType: "BREAKING_NEWS" },
      { OR: [{ publicationType: { not: "BREAKING_NEWS" } }, { publicationType: "BREAKING_NEWS", expiresAt: { gt: now } }] },
    ],
  });
  assert.deepEqual(w.collections, { publicationType: "COLLECTION" });
  assert.deepEqual(w.feed, {}, "feed keeps every type, expired news included (no expiry filter)");
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

test("territory journal keeps pinned-first ordering and regional relevance together", () => {
  const territoryScope = {
    territoryId: "region-minsk", type: "REGION" as const, slug: "minsk",
    territoryIds: ["region-minsk", "city-minsk", "city-suburb"],
    cityTerritoryId: "city-minsk", regionTerritoryId: "region-minsk",
    regionScopeIds: ["region-minsk", "city-minsk", "city-suburb"],
  };
  const buckets = buildJournalFeedBuckets({ id: "legacy-minsk" }, { pinnedFirst: true, territoryScope });
  assert.deepEqual(buckets[0], { group: null, where: { pinned: true } });
  assert.deepEqual(buckets.slice(1).map(bucket => bucket.group), ["CITY", "REGION", "OTHER_CITY", "BELARUS"]);
  for (const bucket of buckets.slice(1)) assert.deepEqual((bucket.where.AND as unknown[])[1], { pinned: false });
  assert.match(JSON.stringify(buckets[2].where), /city-suburb/);
  assert.doesNotMatch(JSON.stringify(buckets), /legacy-minsk/);
});
