import assert from "node:assert/strict";
import {
  bookingCaption,
  bookingStatusLabel,
  pickAutoLinkCandidate,
  pickBookingToShow,
  toDateOnly,
  type PlanBookingState,
} from "./planBookingPure";

const d = (s: string) => new Date(s);
assert.match(bookingStatusLabel("NEW"), /Забронировано/);
assert.equal(bookingStatusLabel("CONFIRMED"), "Подтверждено");

// Newest active booking wins; cancelled is shown only when nothing else exists.
const rows = [
  { id: "a", status: "CANCELLED" as const, createdAt: d("2026-10-03") },
  { id: "b", status: "CONFIRMED" as const, createdAt: d("2026-10-01") },
  { id: "c", status: "NEW" as const, createdAt: d("2026-10-02") },
];
assert.equal(pickBookingToShow(rows)?.id, "c");
assert.equal(pickBookingToShow([rows[0]])?.id, "a");
assert.equal(pickBookingToShow([]), null);

// Auto-link only when unambiguous.
assert.equal(pickAutoLinkCandidate([{ id: "p1", date: "2026-10-10", hasActiveBooking: false }], null), "p1");
assert.equal(pickAutoLinkCandidate([{ id: "p1", date: "2026-10-10", hasActiveBooking: false }, { id: "p2", date: "2026-10-11", hasActiveBooking: false }], null), null);
assert.equal(pickAutoLinkCandidate([{ id: "p1", date: "2026-10-10", hasActiveBooking: false }, { id: "p2", date: "2026-10-11", hasActiveBooking: false }], "2026-10-11"), "p2");
assert.equal(pickAutoLinkCandidate([{ id: "p1", date: "2026-10-10", hasActiveBooking: true }], null), null, "already booked");
assert.equal(pickAutoLinkCandidate([], "2026-10-10"), null);
assert.equal(toDateOnly(d("2026-10-10T00:00:00Z")), "2026-10-10");
assert.equal(toDateOnly(null), null);

const mine: PlanBookingState = { status: "CONFIRMED", label: "Подтверждено", requestedDate: null, requestedTime: "12:00", isMine: true, bookedByName: null };
assert.equal(bookingCaption(mine), "Подтверждено · 12:00");
assert.equal(bookingCaption({ ...mine, isMine: false, bookedByName: "Аня", requestedTime: null }), "Подтверждено · бронь: Аня");
assert.equal(bookingCaption({ ...mine, isMine: false, bookedByName: null, requestedTime: null }), "Подтверждено · бронь: другой взрослый");
console.log("planBooking.test: ok");
