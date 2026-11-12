import assert from "node:assert/strict";
import { resolveBreakingNewsOutcome as r } from "./breakingNewsOutcome";

assert.equal(r("save", "DRAFT"), "draft_saved");
assert.equal(r("save", "REJECTED"), "changes_saved", "a rejected item is not a draft");
assert.equal(r("save", "NEEDS_REVISION"), "changes_saved");
assert.equal(r("save", "SCHEDULED"), "changes_saved");
assert.equal(r("save", "PENDING_UPDATE"), "changes_saved");
assert.equal(r("save", "PUBLISHED"), "changes_published", "editing a published item is not a draft");
assert.equal(r("save", "PENDING"), "changes_saved", "saving a pending item does not claim a submit");
assert.equal(r("submit", "PUBLISHED"), "published");
assert.equal(r("submit", "PENDING"), "submitted");
assert.equal(r("submit", "DRAFT"), null, "no success claimed when server left it a draft");
assert.equal(r("publish", "PUBLISHED"), "published");
assert.equal(r("publish", "PENDING"), null);
assert.equal(r("save", null), null);
assert.equal(r("submit", undefined), null);
// Already-published item: a PUBLISHED response is an edit, not a first publication.
assert.equal(r("submit", "PUBLISHED", "PUBLISHED"), "changes_published");
assert.equal(r("publish", "PUBLISHED", "PUBLISHED"), "changes_published");
assert.equal(r("submit", "PUBLISHED", "PENDING"), "published");
assert.equal(r("publish", "PUBLISHED", "PENDING"), "published");
assert.equal(r("publish", "PUBLISHED", "DRAFT"), "published");
console.log("breakingNewsOutcome.test.ts: OK");
