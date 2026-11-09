import assert from "node:assert/strict";
import { articleDynamicAfishaParams } from "./articleDynamicAfishaFilters";
import { resolveEventDateRange } from "@/server/discovery/eventFilterSemantics";
import { parseQuickFilterPreset } from "@/features/filters/discovery/quickFilterPresets";

const monday = new Date("2026-11-09T12:00:00.000Z");

const all = articleDynamicAfishaParams({}, monday);
assert.equal(all.toString(), "");
assert.equal(resolveEventDateRange({ from: all.get("from") }, monday), null);

const week = articleDynamicAfishaParams({ period: "WEEK" }, monday);
assert.equal(week.get("from"), "2026-11-09");
assert.equal(week.get("to"), "2026-11-15");
const catalogWeek = resolveEventDateRange({ from: week.get("from"), to: week.get("to") }, monday);
assert.ok(catalogWeek, "The catalog event date parser must accept WEEK");
assert.equal(catalogWeek.start.toISOString(), "2026-11-08T21:00:00.000Z");
assert.equal(catalogWeek.end.toISOString(), "2026-11-15T21:00:00.000Z");

const sunday = articleDynamicAfishaParams({ period: "WEEK" }, new Date("2026-11-15T11:00:00Z"));
assert.equal(sunday.get("from"), "2026-11-15");
assert.equal(sunday.get("to"), "2026-11-15");

// Minsk is UTC+3: Sunday 21:30 UTC is already Monday locally.
const minskMonday = articleDynamicAfishaParams({ period: "WEEK" }, new Date("2026-11-08T21:30:00Z"));
assert.equal(minskMonday.get("from"), "2026-11-09");

const weekend = articleDynamicAfishaParams({ period: "WEEKEND", occasionSlug: "new-year" }, monday);
assert.equal(weekend.get("preset"), "weekend");
assert.equal(weekend.get("occasion"), "new-year");
const catalogWeekend = resolveEventDateRange({ preset: parseQuickFilterPreset(weekend.get("preset")) }, monday);
assert.ok(catalogWeekend, "WEEKEND must resolve through existing catalog semantics");
assert.equal(catalogWeekend.start.toISOString(), "2026-11-13T21:00:00.000Z");
assert.equal(catalogWeekend.end.toISOString(), "2026-11-15T21:00:00.000Z");

console.log("Article dynamic afisha: shared catalog date filter contract OK");
