import assert from "node:assert/strict";
import test from "node:test";
import { collectUpcomingOccurrences, resolveShowWindow } from "./window";

// 2026-10-26 — понедельник (Europe/Minsk, UTC+3).
const at = (iso: string) => new Date(`${iso}+03:00`);

test("Mon-Wed: next 7 days from today", () => {
  for (const day of ["2026-10-26", "2026-10-27", "2026-10-28"]) {
    const w = resolveShowWindow(at(`${day}T12:00:00`));
    assert.equal(w.mode, "WEEK");
    assert.equal(w.dateFrom, day);
  }
  const w = resolveShowWindow(at("2026-10-26T12:00:00"));
  assert.equal(w.dateTo, "2026-11-01");
});

test("Thu and Fri: upcoming Saturday-Sunday", () => {
  for (const day of ["2026-10-29", "2026-10-30"]) {
    const w = resolveShowWindow(at(`${day}T09:00:00`));
    assert.deepEqual(w, { mode: "WEEKEND", dateFrom: "2026-10-31", dateTo: "2026-11-01" });
  }
});

test("Saturday: today and Sunday; Sunday: only today", () => {
  assert.deepEqual(resolveShowWindow(at("2026-10-31T10:00:00")), {
    mode: "WEEKEND",
    dateFrom: "2026-10-31",
    dateTo: "2026-11-01",
  });
  assert.deepEqual(resolveShowWindow(at("2026-11-01T10:00:00")), {
    mode: "WEEKEND",
    dateFrom: "2026-11-01",
    dateTo: "2026-11-01",
  });
});

test("weekday is evaluated in Europe/Minsk, not UTC", () => {
  // 23:30 UTC воскресенья = 02:30 понедельника в Минске → окно «неделя».
  const w = resolveShowWindow(new Date("2026-11-01T23:30:00Z"));
  assert.equal(w.mode, "WEEK");
  assert.equal(w.dateFrom, "2026-11-02");
});

test("custom week horizon", () => {
  const w = resolveShowWindow(at("2026-10-26T12:00:00"), 3);
  assert.equal(w.dateTo, "2026-10-28");
});

test("occurrences that already ended today are dropped (now lower bound)", () => {
  const rangeStart = at("2026-10-31T00:00:00");
  const rangeEnd = at("2026-11-02T00:00:00");
  const now = at("2026-10-31T18:00:00");
  const morning = at("2026-10-31T10:00:00");
  const evening = at("2026-10-31T19:00:00");
  const sunday = at("2026-11-01T11:00:00");
  assert.deepEqual(
    collectUpcomingOccurrences({ sessionStarts: [morning, evening, sunday], nextOccurrenceAt: null, rangeStart, rangeEnd, now }),
    [evening, sunday],
  );
  // единственный сеанс уже прошёл → нет вхождений (даже если nextOccurrenceAt устарел)
  assert.deepEqual(
    collectUpcomingOccurrences({ sessionStarts: [morning], nextOccurrenceAt: morning, rangeStart, rangeEnd, now }),
    [],
  );
});

test("nextOccurrenceAt fallback uses the same lower bound and window end", () => {
  const rangeStart = at("2026-10-31T00:00:00");
  const rangeEnd = at("2026-11-02T00:00:00");
  const now = at("2026-10-31T18:00:00");
  const past = at("2026-10-31T09:00:00");
  const future = at("2026-11-01T12:00:00");
  const beyond = at("2026-11-05T12:00:00");
  assert.deepEqual(collectUpcomingOccurrences({ sessionStarts: [], nextOccurrenceAt: past, rangeStart, rangeEnd, now }), []);
  assert.deepEqual(collectUpcomingOccurrences({ sessionStarts: [], nextOccurrenceAt: future, rangeStart, rangeEnd, now }), [future]);
  assert.deepEqual(collectUpcomingOccurrences({ sessionStarts: [], nextOccurrenceAt: beyond, rangeStart, rangeEnd, now }), []);
});
