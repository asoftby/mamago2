import assert from "node:assert/strict";
import test from "node:test";
import {
  BREAKING_NEWS_STORIES_TTL_DAYS,
  getBreakingNewsStoriesPublishedWindow,
} from "./listBreakingNews";

test("breaking news Stories window is deterministic and bounded by publishedAt", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");
  const window = getBreakingNewsStoriesPublishedWindow(now);

  assert.equal(BREAKING_NEWS_STORIES_TTL_DAYS, 14);
  assert.equal(window.lte.toISOString(), "2026-09-14T12:00:00.000Z");
  assert.equal(window.gte.toISOString(), "2026-08-31T12:00:00.000Z");

  const included = (publishedAt: Date) => publishedAt >= window.gte && publishedAt <= window.lte;
  assert.equal(included(now), true, "fresh publication is included");
  assert.equal(included(new Date("2026-09-01T12:00:00.000Z")), true, "publication younger than 14 days is included");
  assert.equal(included(window.gte), true, "14-day boundary is included");
  assert.equal(included(new Date("2026-08-31T11:59:59.999Z")), false, "older publication is excluded");
  assert.equal(included(new Date("2026-09-14T12:00:00.001Z")), false, "future publication is excluded");
});
