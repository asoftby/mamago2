import assert from "node:assert/strict";
import test from "node:test";
import { BookingMode } from "@prisma/client";
import { deriveEventRequestBookingColumns } from "./eventRequestBookingColumns";

const off = { bookingEnabled: false, bookingMode: null };
const on = { bookingEnabled: true, bookingMode: BookingMode.REQUEST_ONLY };

test("request mode turns request-only booking on", () => {
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: "request", current: off }), on);
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: " request ", current: off }), on);
});

test("request mode already applied changes nothing", () => {
  assert.equal(deriveEventRequestBookingColumns({ participationMode: "request", current: on }), null);
});

test("leaving request mode turns off only what we turned on", () => {
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: "walk-in", current: on }), off);
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: "external-link", current: on }), off);
});

test("booking configured another way is never touched", () => {
  const slots = { bookingEnabled: true, bookingMode: BookingMode.USE_PUBLICATION_SLOTS };
  assert.equal(deriveEventRequestBookingColumns({ participationMode: "walk-in", current: slots }), null);
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: "request", current: slots }), on);
  assert.equal(deriveEventRequestBookingColumns({ participationMode: "walk-in", current: off }), null);
  assert.equal(deriveEventRequestBookingColumns({ participationMode: undefined, current: off }), null);
});
