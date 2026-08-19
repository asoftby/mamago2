import * as assert from "node:assert/strict";

import { parsePlaceEditorStepQuery } from "./placeEditorStepQuery";

assert.equal(parsePlaceEditorStepQuery(null), null);
assert.equal(parsePlaceEditorStepQuery(""), null);
assert.equal(parsePlaceEditorStepQuery("999"), null);
assert.equal(parsePlaceEditorStepQuery("-1"), null);
assert.equal(parsePlaceEditorStepQuery("0"), null);
assert.equal(parsePlaceEditorStepQuery("NaN"), null);
assert.equal(parsePlaceEditorStepQuery("foo"), null);

assert.equal(parsePlaceEditorStepQuery("1"), 1);
assert.equal(parsePlaceEditorStepQuery("review"), 7);
assert.equal(parsePlaceEditorStepQuery("faq"), 6);

assert.equal(parsePlaceEditorStepQuery("999", true), null);
assert.equal(parsePlaceEditorStepQuery("-1", true), null);
assert.equal(parsePlaceEditorStepQuery("0", true), null);
assert.equal(parsePlaceEditorStepQuery("NaN", true), null);
assert.equal(parsePlaceEditorStepQuery("foo", true), null);

assert.equal(parsePlaceEditorStepQuery("cta", true), 6);
assert.equal(parsePlaceEditorStepQuery("faq", true), 7);
assert.equal(parsePlaceEditorStepQuery("review", true), 8);

console.log("place editor step query tests: OK");
