import assert from "node:assert";
import {
  comparisonPercent,
  parsePerformancePeriod,
  ratioPercent,
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

assert.equal(ratioPercent(7, 10), 70);
assert.equal(ratioPercent(0, 0), null);
assert.equal(comparisonPercent(12, 10), 20);
assert.equal(comparisonPercent(7, 10), -30);
assert.equal(comparisonPercent(0, 0), null);

console.log("performance metric calculations tests: OK");
