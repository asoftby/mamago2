import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBoostCountdown,
  formatBoostCountdownHms,
  formatBoostCountdownAria,
  getBoostRemainingMs,
  getActiveBoostEndAt,
} from "./boostCountdown";

test("legacy minute API remains compatible", () => {
  assert.equal(formatBoostCountdown(1440), "24:00");
  assert.equal(formatBoostCountdown(1), "00:01");
});

test("one live HH:MM:SS formatter for active and free Boost", () => {
  assert.equal(formatBoostCountdownHms(86_400_000), "24:00:00");
  assert.equal(formatBoostCountdownHms(3_599_000), "00:59:59");
  assert.equal(formatBoostCountdownHms(3_600_000), "01:00:00");
  assert.equal(formatBoostCountdownHms(999), "00:00:01");
  assert.equal(formatBoostCountdownHms(0), "00:00:00");
  assert.match(formatBoostCountdownAria(61_000), /1 мин 1 сек/);
});

test("deadline is from server, never fabricated", () => {
  const endAt = "2026-11-22T12:00:00.000Z";
  const now = Date.parse("2026-11-21T12:00:00.000Z");
  assert.equal(getBoostRemainingMs(endAt, now), 86_400_000);
  assert.equal(getBoostRemainingMs(endAt, now + 86_400_001), 0);
  assert.equal(getBoostRemainingMs(null, now), null);
  assert.equal(getBoostRemainingMs("invalid", now), null);
});

test("active Boost end only comes from active promotion period", () => {
  const past = new Date("2026-11-20T12:00:00Z");
  const live = new Date("2026-11-22T12:00:00Z");
  assert.equal(getActiveBoostEndAt({ periods: [
    { isActive: false, endAt: past },
    { isActive: true, endAt: live },
  ] }), live);
  assert.equal(getActiveBoostEndAt({ periods: [{ isActive: false, endAt: past }] }), null);
  assert.equal(getActiveBoostEndAt(null), null);
});
