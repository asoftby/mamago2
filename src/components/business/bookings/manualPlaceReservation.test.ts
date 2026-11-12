import assert from "node:assert/strict";
import { test } from "node:test";
import { buildManualPlaceReservation } from "./manualPlaceReservation";

const common = {
  bookingUnitId: "worker-1",
  date: "2026-11-18",
  time: "14:00",
  timezone: "Europe/Minsk",
  durationMinutes: 90,
  prepMinutes: 15,
  cleanupMinutes: 30,
};

test("90-minute manual place booking and buffers use Minsk time, not host timezone", () => {
  const reservation = buildManualPlaceReservation(common);
  assert.ok(reservation);
  assert.deepEqual(reservation.resourceReservation, {
    bookingUnitId: "worker-1",
    startsAt: "2026-11-18T11:00:00.000Z",
    endsAt: "2026-11-18T12:30:00.000Z",
  });
  assert.equal(reservation.blockStart.toISOString(), "2026-11-18T10:45:00.000Z");
  assert.equal(reservation.blockEnd.toISOString(), "2026-11-18T13:00:00.000Z");
});

test("different resource timezone creates a different UTC interval", () => {
  const result = buildManualPlaceReservation({ ...common, timezone: "Europe/Warsaw" });
  assert.ok(result);
  assert.equal(result.resourceReservation.startsAt, "2026-11-18T13:00:00.000Z");
});

test("invalid dates, time strings and duration cannot create a resource reservation", () => {
  assert.equal(buildManualPlaceReservation({ ...common, date: "" }), null);
  assert.equal(buildManualPlaceReservation({ ...common, time: "25:00" }), null);
  assert.equal(buildManualPlaceReservation({ ...common, durationMinutes: 0 }), null);
  assert.equal(buildManualPlaceReservation({ ...common, durationMinutes: 1500 }), null);
  assert.equal(buildManualPlaceReservation({
    ...common, date: "2026-03-29", time: "02:30", timezone: "Europe/Warsaw",
  }), null, "DST gap must not silently normalize into a different hour");
});

test("overnight manually agreed interval preserves actual calendar date after midnight", () => {
  const result = buildManualPlaceReservation({
    ...common, time: "23:30", durationMinutes: 60, prepMinutes: 0, cleanupMinutes: 0,
  });
  assert.ok(result);
  assert.equal(result.resourceReservation.startsAt, "2026-11-18T20:30:00.000Z");
  assert.equal(result.resourceReservation.endsAt, "2026-11-18T21:30:00.000Z");
});
