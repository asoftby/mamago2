/**
 * Weekly bucketing for rolling metric history — no DB required.
 * Run: npx tsx src/server/ops/snapshot/weeklyHistory.test.ts
 */
import assert from "node:assert/strict";

import { bucketLastValuePerWeek, isoWeekInTimeZone } from "./metricProjection";

// Sunday 22:30 UTC is already Monday 01:30 in Minsk — belongs to the next ISO week.
assert.equal(isoWeekInTimeZone(new Date("2026-09-20T22:30:00Z")), "2026-W39");
assert.equal(isoWeekInTimeZone(new Date("2026-09-20T20:00:00Z")), "2026-W38");

assert.deepEqual(
  bucketLastValuePerWeek([
    { collectedAt: new Date("2026-09-16T10:00:00Z"), value: 300 },
    { collectedAt: new Date("2026-09-20T20:00:00Z"), value: 320 },
    { collectedAt: new Date("2026-09-25T10:00:00Z"), value: 360 },
    { collectedAt: new Date("2026-09-10T10:00:00Z"), value: 250 },
    { collectedAt: new Date("2026-09-22T10:00:00Z"), value: 340 },
  ]),
  [
    { isoWeek: "2026-W37", value: 250 },
    { isoWeek: "2026-W38", value: 320 },
    { isoWeek: "2026-W39", value: 360 },
  ],
  "last reading of each week, ordered by week, unsorted input tolerated",
);
assert.deepEqual(bucketLastValuePerWeek([]), []);

console.log("weeklyHistory.test.ts: OK");
