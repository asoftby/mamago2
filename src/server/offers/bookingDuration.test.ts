import assert from "node:assert/strict";
import test from "node:test";
import { assertBookingDuration, durationChoices } from "./bookingDuration";
import { calculateBookingPrice } from "./bookingPrice";

const duration = {
  scheduleKind: "ON_REQUEST_WINDOWS",
  durationMin: 60,
  maxExtensionHours: 3,
  extensionHourPriceByn: "30.00",
  extensionDiscountPercent: 15,
  hasClassGroups: false,
};

test("exclusive resources support whole additional hours, no fractional shortcut", () => {
  assert.deepEqual(durationChoices(duration), [60, 120, 180, 240]);
  assert.equal(assertBookingDuration(duration, 180), 2);
  for (const m of [30, 90, 119, 241, 540]) {
    assert.throws(() => assertBookingDuration(duration, m), RangeError);
  }
});
test("legacy, class, unpriced and group schedules never get extra time", () => {
  assert.deepEqual(durationChoices({ ...duration, maxExtensionHours: 0 }), [60]);
  assert.deepEqual(durationChoices({ ...duration, scheduleKind: "DATED_SESSIONS" }), [60]);
  assert.deepEqual(durationChoices({ ...duration, extensionHourPriceByn: null }), [60]);
  assert.deepEqual(durationChoices({ ...duration, hasClassGroups: true }), [60]);
});
test("extra hours use integer kopeks and discount never affects the base fee", () => {
  const { snapshot } = calculateBookingPrice({
    currency: "BYN", seats: 1, durationMinutes: 180, baseDurationMinutes: 60,
    extensionHourPriceByn: "30.00", extensionDiscountPercent: 15,
    basePriceByn: "100.00", tariff: null, options: [],
  });
  assert.equal(snapshot.totalByn, "151.00");
  assert.deepEqual(snapshot.extension, {
    hours: 2, hourlyRateByn: "30.00", discountPercent: 15, amountByn: "51.00",
  });
});
test("one-kopek discounts round once at extension subtotal", () => {
  const { snapshot } = calculateBookingPrice({
    currency: "BYN", seats: 1, durationMinutes: 120, baseDurationMinutes: 60,
    extensionHourPriceByn: "0.05", extensionDiscountPercent: 10,
    basePriceByn: "10.00", tariff: null, options: [],
  });
  assert.equal(snapshot.totalByn, "10.05");
});
test("missing base price remains a quote despite a known hourly rate", () => {
  const { snapshot } = calculateBookingPrice({
    currency: "BYN", seats: 1, durationMinutes: 120, baseDurationMinutes: 60,
    extensionHourPriceByn: "20", extensionDiscountPercent: 0,
    basePriceByn: null, tariff: null, options: [],
  });
  assert.equal(snapshot.status, "QUOTE_REQUIRED");
  assert.equal(snapshot.totalByn, null);
  assert.equal(snapshot.extension?.amountByn, "20.00");
});
