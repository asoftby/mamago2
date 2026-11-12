import assert from "node:assert/strict";
import test from "node:test";
import { articleRatingTitle } from "./articleRatingTitle";

test("collection gets its own question, everything else keeps the default", () => {
  assert.equal(articleRatingTitle("COLLECTION"), "Как вам подборка?");
  assert.equal(articleRatingTitle("ARTICLE"), "Была полезна статья?");
  assert.equal(articleRatingTitle("BREAKING_NEWS"), "Была полезна статья?");
  assert.equal(articleRatingTitle(undefined), "Была полезна статья?");
  assert.equal(articleRatingTitle(null), "Была полезна статья?");
});
