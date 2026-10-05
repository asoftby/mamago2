import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarWeekRange,
  resolveCalendarDateParam,
  shouldFetchCalendarWeek,
  upsertCalendarWeekItem,
  scenarioStatusesAfterManualSave,
  scenarioStatusesAfterManualCancel,
} from "./familyCalendarNavigation";

test("date URL parsing is strict and week navigation supports past dates", () => {
  assert.equal(resolveCalendarDateParam("2026-09-28", "2026-10-03"), "2026-09-28");
  assert.equal(resolveCalendarDateParam("2026-02-30", "2026-10-03"), "2026-10-03");
  assert.equal(resolveCalendarDateParam(["2026-09-28"], "2026-10-03"), "2026-10-03");
  assert.deepEqual(calendarWeekRange("2026-09-30"), { from: "2026-09-28", to: "2026-10-04" });
});

test("Scenario status changes only for manual schedule, person, or membership changes", () => {
  const base = { "2026-10-01": "ready" as const, "2026-10-02": "ready" as const };
  const item = {
    date: "2026-10-01", startsAt: "2026-10-01T07:00:00.000Z",
    endsAt: "2026-10-01T08:00:00.000Z", childId: "child-a",
    title: "Before", notes: "Before", locationText: "Before", entryType: "ACTIVITY",
  };
  for (const patch of [
    { title: "After" }, { notes: "After" }, { locationText: "After" }, { entryType: "TASK" },
  ]) {
    assert.deepEqual(scenarioStatusesAfterManualSave(base, item, { ...item, ...patch }), base);
  }
  for (const patch of [
    { startsAt: "2026-10-01T07:30:00.000Z" },
    { endsAt: "2026-10-01T08:30:00.000Z" },
    { childId: "child-b" },
  ]) {
    assert.equal(scenarioStatusesAfterManualSave(base, item, { ...item, ...patch })[item.date], "changed");
  }
  assert.deepEqual(scenarioStatusesAfterManualSave(base, item, { ...item, date: "2026-10-02" }), {
    "2026-10-01": "changed", "2026-10-02": "changed",
  });
  assert.equal(scenarioStatusesAfterManualSave(base, null, item)[item.date], "changed");
  assert.equal(scenarioStatusesAfterManualCancel(base, item)[item.date], "changed");
  assert.deepEqual(scenarioStatusesAfterManualSave({}, null, item), {});
});

test("a loaded week is fetched once and moving an item updates both cached weeks", () => {
  const cache = { "2026-09-28": [{ id: "item", date: "2026-10-01" }] };
  assert.equal(shouldFetchCalendarWeek(cache, "2026-10-02"), false);
  assert.equal(shouldFetchCalendarWeek(cache, "2026-10-05"), true);
  const moved = upsertCalendarWeekItem(cache, { id: "item", date: "2026-10-06" });
  assert.deepEqual(moved["2026-09-28"], []);
  assert.deepEqual(moved["2026-10-05"], [{ id: "item", date: "2026-10-06" }]);
});
