import assert from "node:assert/strict";
import test from "node:test";
import {
  ChildBirthValidationError,
  ageYearsAt,
  fromBirthMonthYear,
  fromExactBirthDate,
  hasExactBirthday,
  nextBirthday,
  normalizeChildName,
} from "./birth";

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

test("DAY stores the real UTC calendar date, including day 1 and day 15", () => {
  assert.equal(fromExactBirthDate("2020-05-01", at("2026-09-30")).birthDate.toISOString(), "2020-05-01T00:00:00.000Z");
  assert.equal(fromExactBirthDate("2020-05-15", at("2026-09-30")).birthDate.toISOString(), "2020-05-15T00:00:00.000Z");
});

test("DAY completed-year age changes on the birthday", () => {
  const record = { birthDate: at("2020-05-15"), birthPrecision: "DAY" as const };
  assert.equal(ageYearsAt(record, at("2026-05-14")), 5);
  assert.equal(ageYearsAt(record, at("2026-05-15")), 6);
  assert.equal(ageYearsAt(record, at("2026-05-16")), 6);
});

test("DAY leap-day age is deterministic", () => {
  const record = { birthDate: at("2020-02-29"), birthPrecision: "DAY" as const };
  assert.equal(ageYearsAt(record, at("2025-02-28")), 4);
  assert.equal(ageYearsAt(record, at("2025-03-01")), 5);
});

test("DAY rejects future, exactly 18 and older", () => {
  assert.throws(() => fromExactBirthDate("2027-01-01", at("2026-09-30")), ChildBirthValidationError);
  assert.throws(() => fromExactBirthDate("2008-09-30", at("2026-09-30")), ChildBirthValidationError);
  assert.throws(() => fromExactBirthDate("2007-09-30", at("2026-09-30")), ChildBirthValidationError);
  assert.throws(() => fromExactBirthDate("2021-02-29", at("2026-09-30")), ChildBirthValidationError);
});

test("MONTH uses canonical UTC day-1 anchor and month-level age", () => {
  const stored = fromBirthMonthYear(2020, 5, at("2026-09-30"));
  assert.equal(stored.birthDate.toISOString(), "2020-05-01T00:00:00.000Z");
  const record = { birthDate: stored.birthDate, birthPrecision: "MONTH" as const };
  assert.equal(ageYearsAt(record, at("2026-04-30")), 5);
  assert.equal(ageYearsAt(record, at("2026-05-01")), 6);
  assert.equal(ageYearsAt(record, at("2026-05-31")), 6);
  assert.equal(ageYearsAt(record, at("2026-06-01")), 6);
});

test("MONTH rejects future and age 18 by month-level contract", () => {
  assert.throws(() => fromBirthMonthYear(2026, 10, at("2026-09-30")), ChildBirthValidationError);
  assert.throws(() => fromBirthMonthYear(2008, 9, at("2026-09-30")), ChildBirthValidationError);
});

test("legacy null precision ignores stored day and has no exact birthday", () => {
  for (const day of ["01", "15", "27"]) {
    const record = { birthDate: at(`2020-05-${day}`), birthPrecision: null };
    assert.equal(ageYearsAt(record, at("2026-05-01")), 6);
    assert.equal(hasExactBirthday(record), false);
    assert.equal(nextBirthday(record, at("2026-01-01")), null);
    assert.equal(record.birthPrecision, null);
  }
});

test("exact birthday helpers are DAY-only", () => {
  const exact = { birthDate: at("2020-05-15"), birthPrecision: "DAY" as const };
  assert.equal(hasExactBirthday(exact), true);
  assert.equal(nextBirthday(exact, at("2026-05-16"))?.toISOString(), "2027-05-15T00:00:00.000Z");
});

test("empty child names normalize to null", () => {
  assert.equal(normalizeChildName("  "), null);
  assert.equal(normalizeChildName(null), null);
  assert.equal(normalizeChildName(" Стёпа "), "Стёпа");
});
