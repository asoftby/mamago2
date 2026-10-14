import assert from "node:assert/strict";
import { test } from "node:test";
import { BookingMode, ScheduleKind } from "@prisma/client";
import { calculateSlots, type SlotSnapshot } from "./slotAvailability";
import { localMinuteToUtc } from "./slotTime";

const now = new Date("2026-03-20T00:00:00.000Z");

function base(overrides: Partial<SlotSnapshot> = {}): SlotSnapshot {
  return {
    mode: BookingMode.USE_PUBLICATION_SLOTS,
    scheduleKind: ScheduleKind.RECURRING_SESSIONS,
    timezone: "Europe/Minsk",
    leadTimeHours: 0,
    horizonDays: 60,
    durationMin: 60,
    bufferMin: 0,
    capacity: 12,
    rules: [], closedDates: [], sessions: [], requests: [], openingHours: null, units: [],
    ...overrides,
  };
}

function slots(snapshot: SlotSnapshot, from: string, to: string, requestedSeats = 1) {
  return calculateSlots(snapshot, { from: new Date(from), to: new Date(to), requestedSeats }, now);
}

test("group seats count only confirmed and unexpired NEW holds", () => {
  const startAt = new Date("2026-03-23T07:00:00.000Z");
  const snapshot = base({
    scheduleKind: ScheduleKind.DATED_SESSIONS,
    sessions: [{ id: "s1", startAt, endAt: new Date("2026-03-23T08:00:00.000Z"), capacity: 3, isCancelled: false }],
    requests: [
      { offerSessionId: "s1", startsAt: null, seats: 1, status: "CONFIRMED", holdUntil: null },
      { offerSessionId: "s1", startsAt: null, seats: 1, status: "NEW", holdUntil: new Date("2026-03-20T01:00:00Z") },
      { offerSessionId: "s1", startsAt: null, seats: 1, status: "NEW", holdUntil: new Date("2026-03-19T23:00:00Z") },
    ],
  });
  const result = slots(snapshot, "2026-03-23T00:00:00Z", "2026-03-24T00:00:00Z");
  assert.equal(result.length, 1);
  assert.equal(result[0].remainingSeats, 1);
  assert.equal(slots(snapshot, "2026-03-23T00:00:00Z", "2026-03-24T00:00:00Z", 2).length, 0);
});

test("Warsaw spring gap is invalid and autumn repeated minute picks first occurrence", () => {
  assert.equal(localMinuteToUtc("2026-03-29", 150, "Europe/Warsaw"), null);
  assert.equal(localMinuteToUtc("2026-10-25", 150, "Europe/Warsaw")?.toISOString(), "2026-10-25T00:30:00.000Z");
  assert.equal(localMinuteToUtc("2026-03-29", 180, "Europe/Warsaw")?.toISOString(), "2026-03-29T01:00:00.000Z");
  assert.equal(localMinuteToUtc("2026-03-29", 150, "Europe/Minsk")?.toISOString(), "2026-03-28T23:30:00.000Z");
});

test("resource allocation uses half-open interval, buffers and expired holds", () => {
  const unit: SlotSnapshot["units"][number] = {
    id: "room", timezone: "Europe/Minsk", prepMinutes: 0, cleanupMinutes: 0, stepMinutes: 15, minDurationMinutes: null,
    rules: [{ weekday: 1, startMinutes: 600, endMinutes: 720 }], exceptions: [], blocks: [],
    allocations: [{
      blockStart: new Date("2026-03-23T07:00:00Z"), blockEnd: new Date("2026-03-23T08:00:00Z"),
      status: "CONFIRMED", expiresAt: null,
    }],
  };
  const snapshot = base({ scheduleKind: ScheduleKind.ON_REQUEST_WINDOWS, durationMin: 60, units: [unit] });
  const result = slots(snapshot, "2026-03-23T00:00:00Z", "2026-03-24T00:00:00Z");
  assert.deepEqual(result.map((slot) => slot.startsAt.toISOString()), ["2026-03-23T08:00:00.000Z"]);
  assert.equal(slots({ ...snapshot, bufferMin: 15 }, "2026-03-23T00:00:00Z", "2026-03-24T00:00:00Z").length, 1);
  unit.allocations[0] = { ...unit.allocations[0], status: "HELD", expiresAt: new Date("2026-03-19T00:00:00Z") };
  assert.equal(slots(snapshot, "2026-03-23T00:00:00Z", "2026-03-24T00:00:00Z").length, 5);
});

test("opening hours continue across midnight and honor closed exceptions", () => {
  const snapshot = base({
    scheduleKind: ScheduleKind.OPENING_HOURS,
    durationMin: 60,
    openingHours: {
      mode: "WEEKLY", timezone: "Europe/Minsk",
      rules: [{ dayOfWeek: "MON", isOpen: true, allDay: false, intervals: [{ startTime: "23:00", endTime: "02:00" }] }],
      exceptions: [],
    },
  });
  const result = slots(snapshot, "2026-03-23T00:00:00Z", "2026-03-25T00:00:00Z");
  assert.equal(result[0]?.startsAt.toISOString(), "2026-03-23T20:00:00.000Z");
  assert.equal(result.at(-1)?.startsAt.toISOString(), "2026-03-23T22:00:00.000Z");
  assert.equal(slots({ ...snapshot, closedDates: ["2026-03-24"] }, "2026-03-23T00:00:00Z", "2026-03-25T00:00:00Z").length, 4);
  assert.equal(slots({ ...snapshot, openingHours: {
    ...snapshot.openingHours!,
    exceptions: [{ date: "2026-03-24", isClosed: true, allDay: false, intervals: [] }],
  } }, "2026-03-23T00:00:00Z", "2026-03-25T00:00:00Z").length, 4);
});

test("lead time and horizon clip the preview", () => {
  const snapshot = base({
    scheduleKind: ScheduleKind.DATED_SESSIONS,
    leadTimeHours: 48,
    horizonDays: 4,
    sessions: [
      { id: "too-soon", startAt: new Date("2026-03-21T07:00:00Z"), endAt: new Date("2026-03-21T08:00:00Z"), capacity: 1, isCancelled: false },
      { id: "allowed", startAt: new Date("2026-03-23T07:00:00Z"), endAt: new Date("2026-03-23T08:00:00Z"), capacity: 1, isCancelled: false },
      { id: "too-late", startAt: new Date("2026-03-25T07:00:00Z"), endAt: new Date("2026-03-25T08:00:00Z"), capacity: 1, isCancelled: false },
    ],
  });
  assert.deepEqual(slots(snapshot, "2026-03-20T00:00:00Z", "2026-03-27T00:00:00Z").map((slot) => slot.sessionId), ["allowed"]);
});
