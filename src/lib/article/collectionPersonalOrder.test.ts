import assert from "node:assert/strict";
import test from "node:test";
import { ageFit, ageMonthsFromBirthDate, kidsFromGuestYears, orderCollection, reasonFor, type OrderKid } from "./collectionPersonalOrder";

const items = [
  { id: "teen", ageMinMonths: 120, ageMaxMonths: 192 },
  { id: "any", ageMinMonths: null, ageMaxMonths: null },
  { id: "toddler", ageMinMonths: 12, ageMaxMonths: 48 },
  { id: "school", ageMinMonths: 60, ageMaxMonths: 144 },
];
const stepa: OrderKid = { id: "s", name: "Степа", ageMonths: 7 * 12 + 2 };
const taisia: OrderKid = { id: "t", name: "Таисия", ageMonths: 4 * 12 };

test("fit: bounds, unknown and mismatch", () => {
  assert.equal(ageFit(items[3], stepa.ageMonths), "MATCH");
  assert.equal(ageFit(items[3], stepa), "MATCH");
  assert.equal(ageFit(items[0], stepa.ageMonths), "MISMATCH");
  assert.equal(ageFit(items[1], stepa.ageMonths), "UNKNOWN");
});

test("no kids keeps editorial order and does not mutate input", () => {
  const copy = [...items];
  assert.deepEqual(orderCollection(items, []).map((i) => i.id), ["teen", "any", "toddler", "school"]);
  assert.deepEqual(items, copy);
});

test("matches first, unknown next, mismatch last; stable ties", () => {
  assert.deepEqual(orderCollection(items, [stepa]).map((i) => i.id), ["school", "any", "teen", "toddler"]);
});

test("two kids: item matching both ranks above single matches", () => {
  const both = [...items, { id: "both", ageMinMonths: 24, ageMaxMonths: 144 }];
  assert.equal(orderCollection(both, [stepa, taisia])[0].id, "both");
});

test("reason only on real match", () => {
  assert.equal(reasonFor(items[0], [stepa]), null);
  assert.equal(reasonFor(items[3], [stepa])?.text, "Подходит: Степа, 7 лет");
  assert.equal(reasonFor({ id: "b", ageMinMonths: 24, ageMaxMonths: 144 }, [stepa, taisia])?.text, "Подходит: Степа и Таисия");
});

test("guest reason for under one year", () => {
  assert.equal(reasonFor({ id: "x", ageMinMonths: 0, ageMaxMonths: 24 }, kidsFromGuestYears([0]))?.text, "Подходит до года");
});

test("guest reason has no names", () => {
  assert.equal(reasonFor(items[2], kidsFromGuestYears([3]))?.text, "Подходит для 3 лет");
});

test("birth date to months", () => {
  assert.equal(ageMonthsFromBirthDate("2020-01-15", new Date("2026-03-14")), 73);
  assert.equal(ageMonthsFromBirthDate("2020-01-15", new Date("2026-03-15")), 74);
  assert.equal(ageMonthsFromBirthDate(null), null);
});

test("guest year interval: partial overlap is not a confirmed match", () => {
  const underOne = kidsFromGuestYears([0]);
  assert.equal(reasonFor({ id: "a", ageMinMonths: 6, ageMaxMonths: 12 }, underOne), null);
  assert.equal(ageFit({ id: "a", ageMinMonths: 6, ageMaxMonths: 12 }, underOne[0]), "UNKNOWN");
  assert.equal(ageFit({ id: "b", ageMinMonths: 18, ageMaxMonths: 36 }, kidsFromGuestYears([1])[0]), "UNKNOWN");
  assert.equal(ageFit({ id: "c", ageMinMonths: 24, ageMaxMonths: 60 }, underOne[0]), "MISMATCH");
});
