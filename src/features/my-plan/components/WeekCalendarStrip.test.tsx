import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./WeekCalendarStrip.tsx", import.meta.url), "utf8");

test("calendar keeps desktop week navigation bounded by today", () => {
  assert.match(source, /const canShiftToPreviousWeek = allowPastDates \|\| visibleWeekStart > todayWeekStart;/);
  assert.match(source, /if \(dir === -1 && !canShiftToPreviousWeek\) return;/);
  assert.match(source, /disabled=\{!canShiftToPreviousWeek\}/);
});

test("calendar exposes a Today action on all layouts", () => {
  assert.match(source, />\s*Сегодня\s*<\/button>/);
  assert.match(source, /const selectToday = \(\) => \{/);
  assert.match(source, /selectDate\(todayIso\)/);
});

test("compact mobile swipe moves one date at a time", () => {
  assert.match(source, /const shiftDay = \(dir: 1 \| -1\) => \{/);
  assert.match(source, /selectDate\(addDaysLocal\(selectedDate, dir\)\)/);
  assert.match(source, /if \(compact\) shiftDay\(dx < 0 \? 1 : -1\);/);
  assert.match(source, /else shiftWeek\(dx < 0 \? 1 : -1\);/);
});
