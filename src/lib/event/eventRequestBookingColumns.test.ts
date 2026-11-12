import assert from "node:assert/strict";
import test from "node:test";
import { BookingMode } from "@prisma/client";
import { deriveEventRequestBookingColumns } from "./eventRequestBookingColumns";
import { getEventBookingSchedule } from "./eventBookingSchedule";

const off = { bookingEnabled: false, bookingMode: null };
const on = { bookingEnabled: true, bookingMode: BookingMode.REQUEST_ONLY };

test("request mode turns request-only booking on", () => {
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: "request", current: off, hasBusiness: true }), on);
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: " request ", current: off, hasBusiness: true }), on);
});

test("request mode already applied changes nothing", () => {
  assert.equal(deriveEventRequestBookingColumns({ participationMode: "request", current: on, hasBusiness: true }), null);
});

test("leaving request mode turns off only what we turned on", () => {
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: "walk-in", current: on, hasBusiness: true }), off);
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: "external-link", current: on, hasBusiness: true }), off);
});

test("booking configured another way is never touched", () => {
  const slots = { bookingEnabled: true, bookingMode: BookingMode.USE_PUBLICATION_SLOTS };
  assert.equal(deriveEventRequestBookingColumns({ participationMode: "walk-in", current: slots, hasBusiness: true }), null);
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: "request", current: slots, hasBusiness: true }), on);
  assert.equal(deriveEventRequestBookingColumns({ participationMode: "walk-in", current: off, hasBusiness: true }), null);
  assert.equal(deriveEventRequestBookingColumns({ participationMode: undefined, current: off, hasBusiness: true }), null);
});

test("no business: request signup is never enabled and an earlier one is switched off", () => {
  assert.equal(deriveEventRequestBookingColumns({ participationMode: "request", current: off, hasBusiness: false }), null);
  assert.deepEqual(deriveEventRequestBookingColumns({ participationMode: "request", current: on, hasBusiness: false }), off);
  const slots = { bookingEnabled: true, bookingMode: BookingMode.USE_PUBLICATION_SLOTS };
  assert.equal(deriveEventRequestBookingColumns({ participationMode: "request", current: slots, hasBusiness: false }), null);
});

test("native event preliminary booking creates REQUEST_ONLY; legacy phone/link remain external", () => {
  assert.deepEqual(deriveEventRequestBookingColumns({
    participationMode: "prebook",
    scheduleJson: { prebookMethod: "internal" },
    current: off,
    hasBusiness: true,
  }), on);
  assert.equal(deriveEventRequestBookingColumns({
    participationMode: "prebook",
    scheduleJson: { prebookMethod: "phone", prebookPhone: "+375291234567" },
    current: off,
    hasBusiness: true,
  }), null);
  assert.equal(deriveEventRequestBookingColumns({
    participationMode: "prebook",
    scheduleJson: { prebookMethod: "link", prebookUrl: "https://example.test" },
    current: off,
    hasBusiness: true,
  }), null);
  assert.equal(deriveEventRequestBookingColumns({
    participationMode: "prebook",
    scheduleJson: { prebookMethod: "internal" },
    current: off,
    hasBusiness: false,
  }), null);
  assert.deepEqual(deriveEventRequestBookingColumns({
    participationMode: "prebook",
    scheduleJson: { prebookMethod: "phone" },
    current: on,
    hasBusiness: true,
  }), off);
});


test("enabled legacy booking calendars remain available without a participationMode", () => {
  const timeSlots = {
    dates: [{
      isoDate: "2026-12-12",
      slots: [{ startTime: "14:00", endTime: "15:00", capacity: 5 }],
    }],
  };
  const legacyDraft = {
    participationMode: "walk-in",
    ctaStepDraft: {
      legacyOrigin: "BOOKING",
      actionChoice: "REQUEST",
      requestMode: "CALENDAR",
    },
    timeSlots,
  };
  assert.equal(getEventBookingSchedule(legacyDraft).size, 0);
  assert.equal(
    getEventBookingSchedule(legacyDraft, BookingMode.USE_PUBLICATION_SLOTS).get("2026-12-12|14:00")?.capacity,
    5,
  );
  assert.equal(
    getEventBookingSchedule({ timeSlots }, BookingMode.USE_PUBLICATION_SLOTS).size,
    1,
  );
  assert.equal(
    getEventBookingSchedule(legacyDraft, BookingMode.REQUEST_ONLY).size,
    0,
  );
  assert.equal(
    getEventBookingSchedule({
      ...legacyDraft,
      ctaStepDraft: { ...legacyDraft.ctaStepDraft, actionChoice: "DISCOVER" },
    }, BookingMode.USE_PUBLICATION_SLOTS).size,
    0,
  );
  assert.equal(
    getEventBookingSchedule({
      ...legacyDraft,
      participationMode: "external-link",
    }, BookingMode.USE_PUBLICATION_SLOTS).size,
    0,
  );
});
