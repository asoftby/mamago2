import assert from "node:assert/strict";
import test from "node:test";
import { firstGuestPlanOccurrence, guestPlanDateWindow } from "./guestPlanAvailability";

const minsk = (value: string) => new Date(`${value}+03:00`);

test("today is exactly one Minsk-local day, not a UTC day", () => {
  const window = guestPlanDateWindow("2026-11-03");
  assert.equal(window.start.toISOString(), "2026-11-02T21:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-11-03T21:00:00.000Z");
});

test("weekend covers both Saturday and Sunday", () => {
  const window = guestPlanDateWindow("2026-11-07", "2026-11-08");
  assert.equal(window.start.toISOString(), "2026-11-06T21:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-11-08T21:00:00.000Z");
});

test("a December show is never offered for November 3", () => {
  const { start, end } = guestPlanDateWindow("2026-11-03");
  assert.equal(firstGuestPlanOccurrence({
    sessions: [], hasStoredSessions: false,
    nextOccurrenceAt: minsk("2026-12-28T16:00:00"),
    rangeStart: start, rangeEnd: end, now: minsk("2026-11-03T09:00:00"),
  }), null);
});

test("past morning, withdrawn and stale fallbacks are not shown", () => {
  const { start, end } = guestPlanDateWindow("2026-11-03");
  const evening = minsk("2026-11-03T18:30:00");
  assert.equal(firstGuestPlanOccurrence({
    sessions: [
      { startsAt: minsk("2026-11-03T09:00:00"), withdrawnAt: null },
      { startsAt: minsk("2026-11-03T14:00:00"), withdrawnAt: new Date() },
      { startsAt: evening, withdrawnAt: null },
    ], hasStoredSessions: true,
    nextOccurrenceAt: minsk("2026-11-03T09:00:00"),
    rangeStart: start, rangeEnd: end, now: minsk("2026-11-03T13:00:00"),
  })?.toISOString(), evening.toISOString());
  assert.equal(firstGuestPlanOccurrence({
    sessions: [], hasStoredSessions: true,
    nextOccurrenceAt: evening, rangeStart: start, rangeEnd: end, now: minsk("2026-11-03T13:00:00"),
  }), null, "a withdrawn stored session suppresses denormalized fallback");
});

test("an upcoming stored session or no-session nextOccurrence is accepted", () => {
  const { start, end } = guestPlanDateWindow("2026-11-03");
  const at = minsk("2026-11-03T16:00:00");
  for (const hasStoredSessions of [true, false]) {
    assert.equal(firstGuestPlanOccurrence({
      sessions: hasStoredSessions ? [{ startsAt: at, withdrawnAt: null }] : [],
      hasStoredSessions, nextOccurrenceAt: at,
      rangeStart: start, rangeEnd: end, now: minsk("2026-11-03T12:00:00"),
    })?.toISOString(), at.toISOString());
  }
});
