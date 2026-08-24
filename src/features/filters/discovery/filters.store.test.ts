import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultFilters,
  getDiscoveryFilterActiveCount,
  getModalFilterCount,
  hasAnyNonTrackingUrlParams,
  parseAppliedFromUrl,
  serializeAppliedToSearchParams,
} from "./filters.store";

test("event filters survive URL serialization and parsing", () => {
  const filters = {
    ...defaultFilters,
    whenPreset: "WEEKEND" as const,
    age: ["3-5"],
    format: "OFFLINE" as const,
    district: "central",
    metro: "metro-1",
    free: true,
  };
  const params = serializeAppliedToSearchParams(new URLSearchParams(), filters);
  assert.deepEqual(parseAppliedFromUrl(params as never), filters);
  assert.equal(getDiscoveryFilterActiveCount(filters), 6);
});

test("reset serialization from an empty base clears primary, secondary, and budget", () => {
  const stale = new URLSearchParams("preset=TODAY&free=true&sec=free_only%3Atrue&budget=30");
  const params = serializeAppliedToSearchParams(new URLSearchParams(), defaultFilters);
  assert.equal(params.toString(), "");
  assert.notEqual(stale.toString(), params.toString());
  assert.equal(getDiscoveryFilterActiveCount(defaultFilters), 0);
});

test("adultOnly round-trips and contributes to unified active count", () => {
  const filters = { ...defaultFilters, adultOnly: true };
  const params = serializeAppliedToSearchParams(new URLSearchParams(), filters);
  assert.deepEqual(parseAppliedFromUrl(params as never), filters);
  assert.equal(params.get("adultOnly"), "true");
  assert.equal(getDiscoveryFilterActiveCount(filters), 1);
});

// --- C3: localStorage hydration gate must ignore tracking params ---

test("hydration gate blocks on a real discovery param", () => {
  const params = new URLSearchParams("from=2026-08-29");
  assert.equal(hasAnyNonTrackingUrlParams(params as never), true);
});

test("hydration gate blocks on an unrelated non-tracking param (e.g. a stray share id)", () => {
  const params = new URLSearchParams("ref=abc123");
  assert.equal(hasAnyNonTrackingUrlParams(params as never), true);
});

test("hydration gate does NOT block on utm_* alone — Instagram is the main traffic channel", () => {
  const params = new URLSearchParams(
    "utm_source=instagram&utm_medium=social&utm_campaign=aug&utm_term=x&utm_content=y",
  );
  assert.equal(hasAnyNonTrackingUrlParams(params as never), false);
});

test("hydration gate does NOT block on gclid/fbclid/yclid alone", () => {
  const params = new URLSearchParams("fbclid=abc&gclid=def&yclid=ghi");
  assert.equal(hasAnyNonTrackingUrlParams(params as never), false);
});

test("hydration gate still blocks when a real filter param rides along with utm_*", () => {
  const params = new URLSearchParams("utm_source=instagram&free=true");
  assert.equal(hasAnyNonTrackingUrlParams(params as never), true);
});

// --- E: badge on the "Фильтры" icon must ignore date/whenPreset groups ---

test("getModalFilterCount ignores whenPreset — quick-chip clicks must not light up the modal badge", () => {
  const filters = { ...defaultFilters, whenPreset: "TODAY" as const };
  assert.equal(getModalFilterCount(filters), 0);
});

test("getModalFilterCount ignores dateFrom/dateTo", () => {
  const filters = { ...defaultFilters, dateFrom: "2026-08-29", dateTo: "2026-08-31" };
  assert.equal(getModalFilterCount(filters), 0);
});

test("getModalFilterCount counts age, format, metro-or-district as one group, and free", () => {
  const filters = {
    ...defaultFilters,
    age: ["3-5"],
    format: "OFFLINE" as const,
    metro: "metro-1",
    district: "central",
    free: true,
  };
  // age=1, format=1, (metro+district)=1 group, free=1 => 4
  assert.equal(getModalFilterCount(filters), 4);
});

test("getModalFilterCount folds adultOnly into the age group (A2: chip lives in the age block)", () => {
  const withAdultOnly = { ...defaultFilters, adultOnly: true };
  assert.equal(getModalFilterCount(withAdultOnly), 1);
  const withBoth = { ...defaultFilters, age: ["18+"], adultOnly: true };
  assert.equal(getModalFilterCount(withBoth), 1);
});
