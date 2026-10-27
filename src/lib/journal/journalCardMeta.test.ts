import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCollectionMeta,
  formatJournalRelativeTime,
  journalTypeFilterHref,
  journalTypeFilterParam,
  parseJournalTypeFilter,
} from "./journalCardMeta";

test("type filter query param round-trips; unknown → null", () => {
  for (const type of ["ARTICLE", "COLLECTION", "BREAKING_NEWS"] as const) {
    assert.equal(parseJournalTypeFilter(journalTypeFilterParam(type)), type);
  }
  assert.equal(parseJournalTypeFilter("news"), "BREAKING_NEWS");
  assert.equal(parseJournalTypeFilter("collection"), "COLLECTION", "legacy alias");
  assert.equal(parseJournalTypeFilter(["collection", "news"]), "COLLECTION");
  assert.equal(parseJournalTypeFilter("NEWS"), null);
  assert.equal(parseJournalTypeFilter(undefined), null);
});

test("relative time: minutes and hours today, «вчера», then a date (Europe/Minsk)", () => {
  const now = new Date("2026-10-27T15:00:00+03:00");
  assert.equal(formatJournalRelativeTime(new Date("2026-10-27T14:50:00+03:00"), now), "10 мин");
  assert.equal(formatJournalRelativeTime(new Date("2026-10-27T14:59:50+03:00"), now), "1 мин");
  assert.equal(formatJournalRelativeTime(new Date("2026-10-27T13:00:00+03:00"), now), "2 ч");
  assert.equal(formatJournalRelativeTime(new Date("2026-10-27T00:30:00+03:00"), now), "14 ч");
  assert.equal(formatJournalRelativeTime(new Date("2026-10-26T23:30:00+03:00"), now), "вчера");
  assert.equal(formatJournalRelativeTime(new Date("2026-10-25T12:00:00+03:00"), now), "25 октября");
});

test("collection meta counts events or places", () => {
  assert.equal(formatCollectionMeta(10, 10), "10 событий");
  assert.equal(formatCollectionMeta(3, 3), "3 события");
  assert.equal(formatCollectionMeta(10, 4), "10 мест");
  assert.equal(formatCollectionMeta(1, 0), "1 место");
  assert.equal(formatCollectionMeta(0, 0), "0 мест");
});

test("type filter href keeps existing query", () => {
  assert.equal(journalTypeFilterHref("/minsk/blog", "BREAKING_NEWS"), "/minsk/blog?type=news");
  assert.equal(journalTypeFilterHref("/minsk/blog/category/sovety?tag=leto", "COLLECTION"), "/minsk/blog/category/sovety?tag=leto&type=collections");
});
