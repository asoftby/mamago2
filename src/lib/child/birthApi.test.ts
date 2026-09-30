import assert from "node:assert/strict";
import test from "node:test";
import { ChildBirthValidationError } from "./birth";
import { parseChildBirthPayload } from "./birthApi";

const target = new Date("2026-09-30T00:00:00.000Z");

test("API accepts explicit DAY and MONTH semantic inputs", () => {
  const day = parseChildBirthPayload({ birthDate: "2020-05-17", birthPrecision: "DAY" }, target);
  assert.equal(day.touched && day.value?.birthPrecision, "DAY");
  const month = parseChildBirthPayload({ birthYear: 2020, birthMonth: 5, birthPrecision: "MONTH" }, target);
  assert.equal(month.touched && month.value?.birthDate.toISOString(), "2020-05-01T00:00:00.000Z");
});

test("API rejects missing precision and malformed precision combinations", () => {
  assert.throws(() => parseChildBirthPayload({ birthDate: "2020-05-17" }, target), ChildBirthValidationError);
  assert.throws(
    () => parseChildBirthPayload({ birthDate: "2020-05-17", birthPrecision: "MONTH" }, target),
    ChildBirthValidationError,
  );
  assert.throws(
    () => parseChildBirthPayload({ birthYear: 2020, birthMonth: 5, birthPrecision: "DAY" }, target),
    ChildBirthValidationError,
  );
});

test("omitted birth is untouched while explicit null clears it", () => {
  assert.deepEqual(parseChildBirthPayload({}, target), { touched: false });
  assert.deepEqual(parseChildBirthPayload({ birthDate: null }, target), { touched: true, value: null });
});
