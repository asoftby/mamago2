import assert from "node:assert/strict";
import { eventBookingSlotKey } from "@/lib/event/eventBookingSchedule";
import { computeEventSlotAvailability } from "./eventSlotAvailability";

// 2026-11-16 10:00 Minsk (UTC+3) = 07:00Z
const start = new Date("2026-11-16T07:00:00Z");
const configured = new Map([
  [eventBookingSlotKey("2026-11-16", "10:00"), { date: "2026-11-16", startTime: "10:00", endTime: "11:00", capacity: 8 }],
]);
const sessions = [{ id: "s1", startsAt: start }];

// Seats held by NEW/CONFIRMED requests (session-linked and date/time-only) are subtracted.
assert.deepEqual(
  computeEventSlotAvailability({
    sessions, configured, fallbackCapacity: null,
    bookings: [
      { adultsCount: 2, childrenCount: 1, session: { startsAt: start }, requestedDate: null, requestedTime: null },
      { adultsCount: 1, childrenCount: 0, session: null, requestedDate: new Date("2026-11-16"), requestedTime: "10:00" },
    ],
  }),
  { s1: { capacity: 8, remaining: 4 } },
);

// Never negative.
assert.equal(
  computeEventSlotAvailability({
    sessions, configured, fallbackCapacity: null,
    bookings: [{ adultsCount: 9, childrenCount: 0, session: { startsAt: start }, requestedDate: null, requestedTime: null }],
  }).s1?.remaining,
  0,
);

// Slot without its own capacity uses the event-wide fallback; with neither, it is omitted.
assert.equal(computeEventSlotAvailability({ sessions, configured: new Map(), fallbackCapacity: 5, bookings: [] }).s1?.remaining, 5);
assert.deepEqual(computeEventSlotAvailability({ sessions, configured: new Map(), fallbackCapacity: null, bookings: [] }), {});

console.log("eventSlotAvailability: ok");
