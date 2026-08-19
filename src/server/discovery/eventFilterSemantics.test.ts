import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEffectivePlaceDistrictWhere,
  buildEffectivePlaceMetroWhere,
  buildEventRuntimeWhere,
  isStructuredFreeEvent,
  resolveEventDateRange,
} from "./eventFilterSemantics";

test("date presets use Europe/Minsk calendar boundaries", () => {
  const now = new Date("2026-08-12T21:30:00.000Z"); // 00:30 Thursday in Minsk
  const today = resolveEventDateRange({ preset: "TODAY" }, now);
  const tomorrow = resolveEventDateRange({ preset: "TOMORROW" }, now);
  assert.equal(today?.start.toISOString(), "2026-08-12T21:00:00.000Z");
  assert.equal(today?.end.toISOString(), "2026-08-13T21:00:00.000Z");
  assert.equal(tomorrow?.start.toISOString(), "2026-08-13T21:00:00.000Z");
});

test("weekend means the upcoming Minsk Saturday and Sunday", () => {
  const range = resolveEventDateRange(
    { preset: "WEEKEND" },
    new Date("2026-08-12T09:00:00.000Z"),
  );
  assert.equal(range?.start.toISOString(), "2026-08-14T21:00:00.000Z");
  assert.equal(range?.end.toISOString(), "2026-08-16T21:00:00.000Z");
});

test("custom dates are inclusive and invalid dates do not constrain results", () => {
  const range = resolveEventDateRange({ from: "2026-08-20", to: "2026-08-22" });
  assert.equal(range?.start.toISOString(), "2026-08-19T21:00:00.000Z");
  assert.equal(range?.end.toISOString(), "2026-08-22T21:00:00.000Z");
  assert.equal(resolveEventDateRange({ from: "not-a-date" }), null);
});

test("free requires explicit structured free state", () => {
  assert.equal(isStructuredFreeEvent({ priceFrom: 0 }), true);
  assert.equal(isStructuredFreeEvent({ priceFrom: null, scheduleJson: { pricingMode: "free" } }), true);
  assert.equal(isStructuredFreeEvent({ priceFrom: null, scheduleJson: {} }), false);
  assert.equal(isStructuredFreeEvent({ priceFrom: 45, scheduleJson: { pricingMode: "fixed" } }), false);
  assert.equal(isStructuredFreeEvent({ priceFrom: null }), false);
});

test("resolved date range becomes an ActivitySession inclusion predicate", () => {
  const dateRange = resolveEventDateRange({ from: "2026-09-12" });
  const where = buildEventRuntimeWhere({ dateRange, free: false, districtId: null, metroId: null, adultOnly: false });
  assert.deepEqual(where, [{ sessions: { some: { startsAt: { gte: dateRange?.start, lt: dateRange?.end } } } }]);
});

test("manual geo assignment wins and auto is used only when manual is absent", () => {
  assert.deepEqual(buildEffectivePlaceDistrictWhere("district-1"), {
    OR: [
      { districtManualId: "district-1" },
      { districtManualId: null, districtAutoId: "district-1" },
    ],
  });
  assert.deepEqual(buildEffectivePlaceMetroWhere("metro-1"), {
    OR: [
      { metroManualId: "metro-1" },
      { metroManualId: null, metroAutoId: "metro-1" },
    ],
  });
});

test("adult-only uses the typed executable predicate", () => {
  assert.deepEqual(
    buildEventRuntimeWhere({ dateRange: null, free: false, districtId: null, metroId: null, adultOnly: true }),
    [{ agePolicy: "ADULT_ONLY" }],
  );
});
