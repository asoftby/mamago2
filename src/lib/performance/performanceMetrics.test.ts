import assert from "node:assert";
import {
  comparisonPercent,
  parsePerformancePeriod,
  ratioPercent,
  resolveCompletedWindow,
  resolvePerformanceWindow,
} from "./performanceMetrics";

assert.equal(parsePerformancePeriod(undefined), "7d");
assert.equal(parsePerformancePeriod("today"), "today");
assert.equal(parsePerformancePeriod("30d"), "30d");
assert.equal(parsePerformancePeriod("90d"), "7d");

const boundary = new Date("2026-08-11T21:30:00.000Z"); // 00:30 on Aug 12 in Minsk
const today = resolvePerformanceWindow("today", boundary);
assert.equal(today.start.toISOString(), "2026-08-11T21:00:00.000Z");
assert.equal(today.end.toISOString(), boundary.toISOString());
assert.equal(today.previousStart.toISOString(), "2026-08-10T21:00:00.000Z");
assert.equal(today.previousEnd.toISOString(), today.start.toISOString());

const seven = resolvePerformanceWindow("7d", boundary);
assert.equal(seven.start.toISOString(), "2026-08-05T21:00:00.000Z");
assert.equal(seven.previousStart.toISOString(), "2026-07-29T21:00:00.000Z");

const thirty = resolvePerformanceWindow("30d", boundary);
assert.equal(thirty.start.toISOString(), "2026-07-13T21:00:00.000Z");

// C1: completed windows depend only on the Minsk calendar day, never on the hour.
const monday0030 = new Date("2026-08-09T21:30:00.000Z"); // Mon 10 Aug 00:30 Minsk
const sunday2359 = new Date("2026-08-09T20:59:00.000Z"); // Sun 9 Aug 23:59 Minsk
const mondayMorning = resolveCompletedWindow(7, new Date("2026-08-10T05:00:00.000Z"));
const mondayNight = resolveCompletedWindow(7, monday0030);
assert.equal(mondayMorning.start.toISOString(), mondayNight.start.toISOString());
assert.equal(mondayMorning.end.toISOString(), mondayNight.end.toISOString());
assert.equal(mondayMorning.start.toISOString(), "2026-08-02T21:00:00.000Z"); // Mon 3 Aug 00:00 Minsk
assert.equal(mondayMorning.end.toISOString(), "2026-08-09T20:59:59.999Z"); // end of Sun 9 Aug
assert.equal(mondayMorning.previousStart.toISOString(), "2026-07-26T21:00:00.000Z");
assert.equal(mondayMorning.previousEnd.toISOString(), "2026-08-02T20:59:59.999Z");
assert.equal(mondayMorning.dayCount, 7);
// Sunday 23:59 still sees the window ending on the previous Saturday.
assert.equal(resolveCompletedWindow(7, sunday2359).end.toISOString(), "2026-08-08T20:59:59.999Z");
const completed30 = resolveCompletedWindow(30, monday0030);
assert.equal(completed30.start.toISOString(), "2026-07-10T21:00:00.000Z");
assert.equal(completed30.previousStart.toISOString(), "2026-06-10T21:00:00.000Z");

assert.equal(ratioPercent(7, 10), 70);
assert.equal(ratioPercent(0, 0), null);
assert.equal(comparisonPercent(12, 10), 20);
assert.equal(comparisonPercent(7, 10), -30);
assert.equal(comparisonPercent(0, 0), null);

console.log("performance metric calculations tests: OK");
