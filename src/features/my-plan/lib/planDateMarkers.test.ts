import assert from "node:assert/strict";
import test from "node:test";
import type { PlanItemWithActivity } from "../types/event";
import { selectUpcomingPlanItems } from "./upcomingPlanItems";
import { planDateKey, planMarkerDates, reconcilePlanMarkerCounts } from "./planDateMarkers";

const NOW = new Date("2026-08-05T09:00:00.000Z");

function item(id: string, date = "2026-08-09"): PlanItemWithActivity {
  return {
    id,
    userId: "user",
    activityId: id,
    date,
    startsAt: new Date("2026-08-09T11:00:00.000Z"),
    title: `Activity ${id}`,
    coverImageUrl: null,
    createdAt: NOW,
    activity: null,
  };
}

test("activity on 9 August creates the 2026-08-09 marker", () => {
  const markers = planMarkerDates(reconcilePlanMarkerCounts({ "2026-08-09": 1 }, {}));
  assert.equal(markers.has("2026-08-09"), true);
});

test("the same real plan item feeds upcoming selection and marker", () => {
  const planItem = item("hogwarts");
  const counts = reconcilePlanMarkerCounts({ [planItem.date]: 1 }, {});
  const upcoming = selectUpcomingPlanItems({
    selectedDate: "2026-08-05",
    todayIso: "2026-08-05",
    selectedDateItems: [],
    nearestDate: planItem.date,
    nearestCount: 1,
    nearestItems: [planItem],
    now: NOW,
  });
  assert.equal(upcoming?.items[0]?.id, "hogwarts");
  assert.equal(planMarkerDates(counts).has(planItem.date), true);
});

test("marker does not depend on the selected date", () => {
  const selectedDate = "2026-08-05";
  const markers = planMarkerDates(reconcilePlanMarkerCounts({ "2026-08-09": 1 }, {}));
  assert.notEqual(selectedDate, "2026-08-09");
  assert.equal(markers.has("2026-08-09"), true);
});

test("timestamp is normalized to the product timezone without UTC day drift", () => {
  assert.equal(planDateKey("2026-08-08T22:30:00.000Z"), "2026-08-09");
  assert.equal(planDateKey("2026-08-09"), "2026-08-09");
});

test("multiple activities on one date create one marker", () => {
  const counts = reconcilePlanMarkerCounts({}, { "2026-08-09": [item("one"), item("two")] });
  const markers = planMarkerDates(counts);
  assert.equal(markers.size, 1);
  assert.equal(markers.has("2026-08-09"), true);
});

test("recommendation snapshot alone cannot create a marker", () => {
  const recommendation = item("recommendation");
  const markers = planMarkerDates(reconcilePlanMarkerCounts({}, {}));
  assert.equal(recommendation.date, "2026-08-09");
  assert.equal(markers.has(recommendation.date), false);
});

test("removing the final item removes its marker immediately", () => {
  const before = reconcilePlanMarkerCounts({ "2026-08-09": 1 }, { "2026-08-09": [item("one")] });
  const after = reconcilePlanMarkerCounts(before, { "2026-08-09": [] });
  assert.equal(planMarkerDates(before).has("2026-08-09"), true);
  assert.equal(planMarkerDates(after).has("2026-08-09"), false);
});

test("loaded server reconciliation overrides stale summary counts", () => {
  const reconciled = reconcilePlanMarkerCounts(
    { "2026-08-09": 2, "2026-08-10": 1 },
    { "2026-08-09": [], "2026-08-11": [item("new", "2026-08-11")] },
  );
  assert.deepEqual([...planMarkerDates(reconciled)].sort(), ["2026-08-10", "2026-08-11"]);
});
