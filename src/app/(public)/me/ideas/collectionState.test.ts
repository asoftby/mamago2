import assert from "node:assert/strict";
import { ALL_IDEAS, WITHOUT_COLLECTION, collectionTarget, updateCollectionCounts, visibleInCollection } from "./collectionState";
import type { IdeaItem } from "./types";

const idea = (ideaType: IdeaItem["ideaType"], rowId: string, itemId: string): IdeaItem => ({
  id: rowId, ideaType, activity: { id: itemId, title: "Тест", type: ideaType === "ACTIVITY" ? "EVENT" : ideaType },
  planStatus: "UNPLANNED", isPlanned: false, createdAt: new Date(0).toISOString(),
});

for (const [kind, expected] of [
  ["ACTIVITY", "activityId"], ["OFFER", "offerId"], ["ROUTE", "routeId"], ["ARTICLE", "articleId"],
] as const) {
  assert.deepEqual(collectionTarget(idea(kind, `row-${kind}`, "entity-123")), { [expected]: "entity-123" });
}

const first = idea("ACTIVITY", "row1", "activity1");
const second = idea("ARTICLE", "row2", "article1");
const memberships = { row1: ["collection1", "collection2"] };
assert.equal(visibleInCollection(first, ALL_IDEAS, memberships), true);
assert.equal(visibleInCollection(first, "collection1", memberships), true);
assert.equal(visibleInCollection(first, "collection3", memberships), false);
assert.equal(visibleInCollection(first, WITHOUT_COLLECTION, memberships), false);
assert.equal(visibleInCollection(second, WITHOUT_COLLECTION, memberships), true);
assert.deepEqual(
  [first, second].filter((item) => visibleInCollection(item, WITHOUT_COLLECTION, memberships)).map((item) => item.id),
  ["row2"],
  "Only ideas without memberships are visible in the unsorted two-column section",
);
assert.equal(visibleInCollection(second, ALL_IDEAS, memberships), true, "All ideas remains a navigable collection");

assert.deepEqual(updateCollectionCounts([
  { id: "a", title: "A", count: 1 }, { id: "b", title: "B", count: 0 },
], ["a"], ["b"]), [
  { id: "a", title: "A", count: 0 }, { id: "b", title: "B", count: 1 },
]);
console.log("collectionState.test: ok");
