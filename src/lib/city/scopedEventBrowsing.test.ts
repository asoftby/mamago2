import assert from "node:assert/strict";
import { buildScopedEventHref, isScopedEventBrowsing } from "./scopedEventBrowsing";

assert.equal(isScopedEventBrowsing("/grodno/events", "1"), true);
assert.equal(isScopedEventBrowsing("/grodno/events/", "1"), true);
assert.equal(isScopedEventBrowsing("/grodno/places", "1"), false);
assert.equal(isScopedEventBrowsing("/grodno/events", null), false);
assert.equal(isScopedEventBrowsing("/me/plan", "1"), false);
assert.equal(
  buildScopedEventHref("grodno", {
    preset: "WEEKEND",
    age: "5-7",
    district: "minsk-district",
    metro: "metro-1",
    city: "minsk",
    explore: "0",
  }),
  "/grodno/events?preset=WEEKEND&age=5-7&explore=1",
);
console.log("scoped event browsing tests: OK");
