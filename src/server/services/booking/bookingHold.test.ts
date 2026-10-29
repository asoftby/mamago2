import assert from "node:assert/strict";
import test from "node:test";
import { BookingStatus } from "@prisma/client";
import { assertActiveBookingHold, BookingHoldExpiredError } from "./bookingHold";

const now = new Date("2026-10-29T12:00:00.000Z");
test("expired group hold cannot be confirmed without an allocation", () => {
  assert.throws(
    () => assertActiveBookingHold(BookingStatus.CONFIRMED, new Date(now.getTime() - 1), now),
    BookingHoldExpiredError,
  );
});
test("expiry boundary is exclusive", () => {
  assert.throws(
    () => assertActiveBookingHold(BookingStatus.CONFIRMED, now, now),
    BookingHoldExpiredError,
  );
});
test("active hold may be confirmed", () => {
  assert.doesNotThrow(
    () => assertActiveBookingHold(BookingStatus.CONFIRMED, new Date(now.getTime() + 1), now),
  );
});
test("legacy request-only booking without a hold stays confirmable", () => {
  assert.doesNotThrow(() => assertActiveBookingHold(BookingStatus.CONFIRMED, null, now));
});
test("expired hold may still be rejected and released", () => {
  assert.doesNotThrow(
    () => assertActiveBookingHold(BookingStatus.REJECTED, new Date(now.getTime() - 1), now),
  );
});
