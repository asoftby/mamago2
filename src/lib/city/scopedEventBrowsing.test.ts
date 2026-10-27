import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildScopedEventHref, isScopedEventBrowsing } from "./scopedEventBrowsing";

assert.equal(isScopedEventBrowsing("/grodno/events", "1"), true);
assert.equal(isScopedEventBrowsing("/grodno/events/", "1"), true);
assert.equal(isScopedEventBrowsing("/grodno/events/some-event", "1"), true);
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
const filtersSource = readFileSync("src/features/filters/discovery/filters.store.ts", "utf8");
assert.match(filtersSource, /isScopedEventBrowsing\(pathname, searchParams.get\("explore"\)\)/);
assert.match(filtersSource, /isScopedEventBrowsing\(path, searchParams.get\("explore"\)\)/);
console.log("scoped event browsing tests: OK");
