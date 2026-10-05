import assert from "node:assert/strict";
import {
  authorCaption,
  filterByScope,
  parsePlanScopeFilter,
  shouldRefreshAfter,
  showFamilyUi,
  visibilityErrorMessage,
} from "./planVisibilityView";

const items = [
  { id: "1", visibility: "FAMILY" as const, authorId: "me", authorName: "Я" },
  { id: "2", visibility: "PRIVATE" as const, authorId: "me", authorName: "Я" },
  { id: "3", visibility: "FAMILY" as const, authorId: "tanya", authorName: "Таня" },
];
assert.deepEqual(filterByScope(items, "all", "me").map((i) => i.id), ["1", "2", "3"]);
assert.deepEqual(filterByScope(items, "family", "me").map((i) => i.id), ["1", "3"]);
assert.deepEqual(filterByScope(items, "mine", "me").map((i) => i.id), ["1", "2"]);

assert.equal(authorCaption(items[0]!, "me"), null);
assert.equal(authorCaption(items[1]!, "me"), null);
assert.equal(authorCaption(items[2]!, "me"), "Добавил(а) Таня");
assert.equal(authorCaption({ ...items[2]!, authorName: " " }, "me"), "Добавил(а) другой взрослый");

assert.equal(showFamilyUi(null), false);
assert.equal(showFamilyUi({ currentUserId: "me", adultsCount: 1 }), false);
assert.equal(showFamilyUi({ currentUserId: "me", adultsCount: 2 }), true);

assert.equal(parsePlanScopeFilter("mine"), "mine");
assert.equal(parsePlanScopeFilter("family"), "family");
assert.equal(parsePlanScopeFilter("garbage"), "all");
assert.equal(parsePlanScopeFilter(null), "all");

assert.match(visibilityErrorMessage("other_adult_acted"), /другой взрослый/);
assert.match(visibilityErrorMessage("conflict"), /свежую/);
assert.match(visibilityErrorMessage(undefined), /Не удалось/);
assert.equal(shouldRefreshAfter("conflict"), true);
assert.equal(shouldRefreshAfter("other_adult_acted"), false);
console.log("planVisibilityView.test: ok");
