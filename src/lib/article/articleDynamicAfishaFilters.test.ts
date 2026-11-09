import assert from "node:assert/strict";
import { articleDynamicAfishaParams } from "./articleDynamicAfishaFilters";
import { buildKudaEventFilters } from "@/server/discovery/kudaListingPage";

const active = new Set(["new-year"]);

const monday = new Date("2026-11-09T12:00:00.000Z");
const all = articleDynamicAfishaParams({}, monday);
assert.equal(all.toString(), "");
assert.equal(buildKudaEventFilters(all, active).dateRange, null);

const week = articleDynamicAfishaParams({ period: "WEEK" }, monday);
assert.equal(week.get("from"), "2026-11-09");
assert.equal(week.get("to"), "2026-11-15");
const catalogWeek = buildKudaEventFilters(week, active).dateRange;
assert.ok(catalogWeek, "The canonical event filter parser must accept WEEK");
assert.equal(catalogWeek.start.toISOString(), "2026-11-08T21:00:00.000Z");
assert.equal(catalogWeek.end.toISOString(), "2026-11-15T21:00:00.000Z");

// Sunday is the last day of this week, never an implicit next-week query.
const sunday = articleDynamicAfishaParams({ period: "WEEK" }, new Date("2026-11-15T11:00:00Z"));
assert.equal(sunday.get("from"), "2026-11-15");
assert.equal(sunday.get("to"), "2026-11-15");

// Crossed midnight in Minsk must already count as Monday.
const minskMonday = articleDynamicAfishaParams({ period: "WEEK" }, new Date("2026-11-08T21:30:00Z"));
assert.equal(minskMonday.get("from"), "2026-11-09");

const weekend = articleDynamicAfishaParams({ period: "WEEKEND", occasionSlug: "new-year" }, monday);
assert.equal(weekend.get("preset"), "weekend");
assert.equal(weekend.get("occasion"), "new-year");
const catalogWeekend = buildKudaEventFilters(weekend, active);
assert.equal(catalogWeekend.occasionSlug, "new-year");
assert.ok(catalogWeekend.dateRange, "WEEKEND must resolve through existing catalog semantics");
// The weekend URL is a rolling preset, so the catalog resolves its dates at request time.
// Do not freeze its dates in this test; week dates above are intentionally fixed.

// The URL parser must NOT accept an inactive occasion: the server-side article
// component separately suppresses this case instead of replacing the theme.
assert.equal(buildKudaEventFilters(weekend, new Set()).occasionSlug, null);

console.log("Article dynamic afisha: shared catalog filter contract OK");
