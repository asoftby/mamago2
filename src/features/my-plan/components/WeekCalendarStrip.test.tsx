import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./WeekCalendarStrip.tsx", import.meta.url), "utf8");

test("calendar keeps desktop week navigation bounded by today", () => {
  assert.match(source, /const canShiftToPreviousWeek = allowPastDates \|\| visibleWeekStart > todayWeekStart;/);
  assert.match(source, /if \(dir === -1 && !canShiftToPreviousWeek\) return;/);
  assert.match(source, /disabled=\{!canShiftToPreviousWeek\}/);
  assert.match(source, /gridTemplateColumns: showArrows \? "36px 1fr 36px" : "1fr"/);
});

test("calendar exposes a Today action on all layouts", () => {
  assert.match(source, />\s*Сегодня\s*<\/button>/);
  assert.match(source, /const selectToday = \(\) => \{/);
  assert.match(source, /selectDate\(todayIso\)/);
});

test("compact mobile calendar uses native horizontal scrolling and date snapping", () => {
  assert.match(source, /const compactDays = useMemo/);
  assert.match(source, /onScroll=\{compact \? handleCompactScroll : undefined\}/);
  assert.match(source, /scrollSnapType: compact \? "x mandatory" : undefined/);
  assert.match(source, /scrollSnapAlign: compact \? "center" : undefined/);
  assert.match(source, /overflowX: compact \? "auto" : "visible"/);
  assert.match(source, /data-plan-date=\{iso\}/);
});
