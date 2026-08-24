import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultFilters,
  getDiscoveryFilterActiveCount,
  getModalFilterCount,
  hasAnyNonTrackingUrlParams,
  optimisticFiltersSettled,
  shouldClearStoredDiscoveryState,
  parseAppliedFromUrl,
  serializeAppliedToSearchParams,
} from "./filters.store";

test("explicitly clearing the final filter invalidates stored discovery state", () => {
  assert.equal(shouldClearStoredDiscoveryState(defaultFilters), true);
  assert.equal(
    shouldClearStoredDiscoveryState({ ...defaultFilters, free: true }),
    false,
  );
});

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

test("hydration gate does NOT block on Instagram share ids (igshid/igsh) or ymclid/msclkid/_openstat", () => {
  const params = new URLSearchParams("igshid=abc&igsh=def&ymclid=ghi&msclkid=jkl&_openstat=mno");
  assert.equal(hasAnyNonTrackingUrlParams(params as never), false);
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

test("getModalFilterCount counts 1 when only 18+ is selected and nothing else", () => {
  // Exact scenario flagged in review: adultOnly alone must not fall through the condition.
  assert.equal(getModalFilterCount({ ...defaultFilters, adultOnly: true }), 1);
});

// --- Overlay must not get stuck on CSV order (age has no canonical click order) ---

test("optimisticFiltersSettled ignores age array order — clicking 5-7 then 3-5 still settles against a 3-5,5-7 URL", () => {
  const optimisticFromClickOrder = { ...defaultFilters, age: ["5-7", "3-5"] };
  const appliedFromUrl = { ...defaultFilters, age: ["3-5", "5-7"] };
  assert.equal(optimisticFiltersSettled(optimisticFromClickOrder, appliedFromUrl), true);
});

test("optimisticFiltersSettled is false while a real difference remains (not just reordered)", () => {
  const optimistic = { ...defaultFilters, age: ["3-5"] };
  const appliedFromUrl = { ...defaultFilters, age: ["3-5", "5-7"] };
  assert.equal(optimisticFiltersSettled(optimistic, appliedFromUrl), false);
});

test("optimisticFiltersSettled: identical filters settle", () => {
  const filters = { ...defaultFilters, free: true, metro: "metro-1" };
  assert.equal(optimisticFiltersSettled(filters, { ...filters }), true);
});
