import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultFilters,
  getDiscoveryFilterActiveCount,
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
