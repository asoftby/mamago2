/**
 * Run: npx tsx src/server/services/analytics/analyticsDateRange.test.ts
 */
import assert from "node:assert/strict";
import { analyticsDayKeys, resolveAnalyticsDateRange } from "./analyticsDateRange";

// 01:30 Minsk on 27 Oct = 22:30 UTC on 26 Oct: must be "today" (27 Oct), not yesterday.
const now = new Date("2026-10-26T22:30:00.000Z");
{
  const { start, end } = resolveAnalyticsDateRange("today", now);
  assert.equal(start.toISOString(), "2026-10-26T21:00:00.000Z", "today starts at 00:00 Minsk");
  assert.equal(end.toISOString(), now.toISOString());
  assert.ok(now >= start, "an event at 01:30 Minsk falls into today");
}
{
  const { start } = resolveAnalyticsDateRange("7d", now);
  assert.equal(start.toISOString(), "2026-10-20T21:00:00.000Z", "7d = today + 6 previous Minsk days");
}
{
  const { start } = resolveAnalyticsDateRange("30d", now);
  assert.equal(start.toISOString(), "2026-09-27T21:00:00.000Z");
}
{
  const { start, end } = resolveAnalyticsDateRange("7d", now);
  const keys = analyticsDayKeys(start, end);
  assert.equal(keys.length, 7);
  assert.equal(keys[0], "2026-10-21");
  assert.equal(keys.at(-1), "2026-10-27");
  assert.deepEqual(analyticsDayKeys(start, end, 3), ["2026-10-25", "2026-10-26", "2026-10-27"]);
}
console.log("analyticsDateRange.test.ts: OK");
