/**
 * computeSnoozeUntil() pure tests — no DB required.
 * Run: npx tsx src/server/ops/signals/computeSnoozeUntil.test.ts
 */
import assert from "node:assert/strict";
import { computeSnoozeUntil, isSnoozeChoice } from "./computeSnoozeUntil";

function main() {
  const now = new Date("2026-06-15T12:34:56.000Z");

  assert.equal(computeSnoozeUntil(now, "1h").toISOString(), "2026-06-15T13:34:56.000Z");
  assert.equal(computeSnoozeUntil(now, "24h").toISOString(), "2026-06-16T12:34:56.000Z");
  assert.equal(computeSnoozeUntil(now, "7d").toISOString(), "2026-06-22T12:34:56.000Z");

  // "tomorrow" = next calendar day, 09:00 Europe/Minsk (UTC+3, no DST) = 06:00 UTC.
  assert.equal(computeSnoozeUntil(now, "tomorrow").toISOString(), "2026-06-16T06:00:00.000Z");

  // Late-night Minsk time (23:50 Minsk = 20:50 UTC) must still land on the
  // correct next Minsk calendar day, not two days ahead.
  const lateMinsk = new Date("2026-06-15T20:50:00.000Z"); // 23:50 Minsk
  assert.equal(computeSnoozeUntil(lateMinsk, "tomorrow").toISOString(), "2026-06-16T06:00:00.000Z");

  // Just-after-midnight Minsk time (00:10 Minsk = previous-day 21:10 UTC).
  const justAfterMidnightMinsk = new Date("2026-06-15T21:10:00.000Z"); // 2026-06-16 00:10 Minsk
  assert.equal(computeSnoozeUntil(justAfterMidnightMinsk, "tomorrow").toISOString(), "2026-06-17T06:00:00.000Z");

  assert.ok(isSnoozeChoice("1h"));
  assert.ok(isSnoozeChoice("tomorrow"));
  assert.ok(isSnoozeChoice("24h"));
  assert.ok(isSnoozeChoice("7d"));
  assert.ok(!isSnoozeChoice("8d"));
  assert.ok(!isSnoozeChoice(""));
  assert.ok(!isSnoozeChoice(null));
  assert.ok(!isSnoozeChoice(123));

  console.log("computeSnoozeUntil.test.ts: OK");
}

main();
