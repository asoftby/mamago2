import assert from "node:assert/strict";
import { resolveArticleSubmitAction } from "./articleSubmitPolicy";

assert.equal(resolveArticleSubmitAction("ADMIN"), "publish");
assert.equal(resolveArticleSubmitAction("MODERATOR"), "publish");
assert.equal(resolveArticleSubmitAction("BUSINESS_OWNER"), "submit", "business users keep moderation");
assert.equal(resolveArticleSubmitAction("USER"), "submit");
assert.equal(resolveArticleSubmitAction(undefined), "submit");
console.log("articleSubmitPolicy.test.ts: OK");
