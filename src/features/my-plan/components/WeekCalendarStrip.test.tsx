import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./WeekCalendarStrip.tsx", import.meta.url), "utf8");

test("calendar cannot navigate before the current week when past dates are disabled", () => {
  assert.match(source, /const canShiftToPreviousWeek = allowPastDates \|\| visibleWeekStart > todayWeekStart;/);
  assert.match(source, /if \(dir === -1 && !canShiftToPreviousWeek\) return;/);
  assert.match(source, /disabled=\{!canShiftToPreviousWeek\}/);
});

test("week navigation clamps a preserved weekday to today", () => {
  assert.match(source, /!allowPastDates && preservedDate < todayIso \? todayIso : preservedDate/);
});
