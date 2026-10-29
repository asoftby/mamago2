import assert from "node:assert/strict";
import { test } from "node:test";
import { ageMonthsOnDate, calendarDateKeyToIso, childAgeYearsOnDate } from "./partyDate";

test("calendar keys use a zero-based month", () => {
  assert.equal(calendarDateKeyToIso("2027-0-5"), "2027-01-05");
  assert.equal(calendarDateKeyToIso("2026-9-21"), "2026-10-21");
  assert.equal(calendarDateKeyToIso("2026-11-31"), "2026-12-31");
  assert.equal(calendarDateKeyToIso("2026-12-1"), null);
  assert.equal(calendarDateKeyToIso("2026-1-30"), null);
  assert.equal(calendarDateKeyToIso("2026-10-21T00:00"), null);
  assert.equal(calendarDateKeyToIso(null), null);
});

test("age is counted on the party date, not today", () => {
  // Single-digit calendar keys used to yield an invalid Date and disable the age filter.
  assert.equal(ageMonthsOnDate("2021-10-21", calendarDateKeyToIso("2026-9-21")), 60);
  // December key "11" used to be read as November.
  assert.equal(ageMonthsOnDate("2020-12-25", calendarDateKeyToIso("2026-11-25")), 72);
  assert.equal(ageMonthsOnDate("2021-01-31", calendarDateKeyToIso("2027-0-30")), 71);
});

test("birthday boundaries", () => {
  assert.equal(ageMonthsOnDate("2020-03-15", "2026-03-14"), 71);
  assert.equal(ageMonthsOnDate("2020-03-15", "2026-03-15"), 72);
  assert.equal(ageMonthsOnDate("2020-02-29", "2026-02-28"), 71);
  assert.equal(ageMonthsOnDate("2020-02-29", "2026-03-01"), 72);
  assert.equal(ageMonthsOnDate("2026-03-15", "2026-03-15"), 0);
});

test("invalid or impossible dates disable the age filter", () => {
  assert.equal(ageMonthsOnDate("2026-02-30", "2026-10-21"), null);
  assert.equal(ageMonthsOnDate("2026-9-1", "2026-10-21"), null);
  assert.equal(ageMonthsOnDate("2026-10-21", "2026-9-21"), null);
  assert.equal(ageMonthsOnDate("2027-01-01", "2026-10-21"), null);
  assert.equal(ageMonthsOnDate(null, "2026-10-21"), null);
  assert.equal(ageMonthsOnDate("2020-01-01", null), null);
});

test("child age in full years is sent with the order", () => {
  assert.equal(childAgeYearsOnDate("2020-03-15", "2026-03-14"), 5);
  assert.equal(childAgeYearsOnDate("2020-03-15", "2026-03-15"), 6);
  assert.equal(childAgeYearsOnDate("2000-01-01", "2026-03-15"), null);
  assert.equal(childAgeYearsOnDate(null, "2026-03-15"), null);
});
