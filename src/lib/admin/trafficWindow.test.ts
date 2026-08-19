/**
 * resolveElapsedTodayVsYesterday() pure tests — no DB required.
 * Run: npx tsx src/lib/admin/trafficWindow.test.ts
 */
import assert from "node:assert/strict";
import { resolveElapsedTodayVsYesterday } from "./trafficWindow";

function main() {
  // 14:20 Europe/Minsk (UTC+3, no DST) = 11:20 UTC.
  const now = new Date("2026-06-15T11:20:00.000Z");
  const w = resolveElapsedTodayVsYesterday(now, "Europe/Minsk");

  assert.equal(w.todayStart.toISOString(), "2026-06-14T21:00:00.000Z", "today 00:00 Minsk = previous-day 21:00 UTC");
  assert.equal(w.todayEnd.toISOString(), now.toISOString(), "todayEnd must be exactly `now`, not end-of-day");

  const elapsedMs = w.todayEnd.getTime() - w.todayStart.getTime();
  assert.equal(elapsedMs, 14.333333333333334 * 60 * 60 * 1000, "elapsed must be ~14h20m");

  assert.equal(w.yesterdayStart.toISOString(), "2026-06-13T21:00:00.000Z", "yesterday 00:00 Minsk");
  const yesterdayElapsedMs = w.yesterdayEnd.getTime() - w.yesterdayStart.getTime();
  assert.equal(yesterdayElapsedMs, elapsedMs, "yesterday window must span the exact same elapsed duration as today");
  assert.equal(w.yesterdayEnd.toISOString(), "2026-06-14T11:20:00.000Z", "yesterday end = yesterday 14:20 Minsk, matching today's clock time");

  // Just-after-midnight edge case (00:05 Minsk).
  const justAfterMidnight = new Date("2026-06-14T21:05:00.000Z"); // 2026-06-15 00:05 Minsk
  const w2 = resolveElapsedTodayVsYesterday(justAfterMidnight, "Europe/Minsk");
  assert.equal(w2.todayStart.toISOString(), "2026-06-14T21:00:00.000Z");
  const elapsed2 = w2.todayEnd.getTime() - w2.todayStart.getTime();
  assert.equal(elapsed2, 5 * 60 * 1000, "must handle a tiny 5-minute elapsed window correctly");
  assert.equal(w2.yesterdayStart.toISOString(), "2026-06-13T21:00:00.000Z");
  assert.equal(
    w2.yesterdayEnd.getTime() - w2.yesterdayStart.getTime(),
    elapsed2,
    "tiny elapsed window must still match exactly on the previous day",
  );

  console.log("trafficWindow.test.ts: OK");
}

main();
