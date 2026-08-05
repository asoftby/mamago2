import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRecommendationDrafts,
  recommendationDraftKey,
} from "./planRecommendationDraftStorage";

test("corrupt and obsolete values safely fall back to an empty store", () => {
  assert.deepEqual(parseRecommendationDrafts("not-json"), { v: 1, selectedDate: null, drafts: {} });
  assert.deepEqual(parseRecommendationDrafts('{"v":2,"drafts":{}}'), { v: 1, selectedDate: null, drafts: {} });
});

test("draft keys isolate dates and normalize audience order", () => {
  const first = recommendationDraftKey({ citySlug: "minsk", date: "2026-08-04", audienceIds: ["b", "a"] });
  const same = recommendationDraftKey({ citySlug: "minsk", date: "2026-08-04", audienceIds: ["a", "b"] });
  const nextDay = recommendationDraftKey({ citySlug: "minsk", date: "2026-08-05", audienceIds: ["a", "b"] });
  assert.equal(first, same);
  assert.notEqual(first, nextDay);
});

test("valid drafts survive parsing while malformed entries are ignored", () => {
  const parsed = parseRecommendationDrafts(JSON.stringify({
    v: 1,
    selectedDate: "2026-08-04",
    drafts: {
      good: {
        suggestions: [{ id: "activity-1", title: "Музей" }],
        batchNumber: 2,
        addedActivityIds: ["activity-2"],
        shownActivityIds: ["activity-1", "activity-2"],
        ageRangeValues: ["6-9"],
        lastSuccessfulFetchAt: "2026-08-04T12:00:00.000Z",
      },
      bad: { suggestions: [], batchNumber: "2" },
    },
  }));
  assert.equal(parsed.selectedDate, "2026-08-04");
  assert.equal(parsed.drafts.good?.batchNumber, 2);
  assert.equal(parsed.drafts.bad, undefined);
});
