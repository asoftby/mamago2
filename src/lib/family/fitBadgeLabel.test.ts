import assert from "node:assert/strict";
import test from "node:test";
import { familyFitBadgeLabel } from "./fitBadgeLabel";

test("one shared label formats child names in dative", () => {
  assert.equal(familyFitBadgeLabel({ matchedChildNames: ["Степан"] }), "Подходит Степану");
  assert.equal(familyFitBadgeLabel({ matchedChildNames: ["Тая"] }), "Подходит Тае");
  assert.equal(familyFitBadgeLabel({ matchedChildNames: ["Стёпа"] }), "Подходит Стёпе");
  assert.equal(familyFitBadgeLabel({ matchedChildNames: ["Таисия"] }), "Подходит Таисии");
  assert.equal(familyFitBadgeLabel({ matchedChildNames: ["Степан", "Тая"] }), "Подходит Степану и Тае");
});
test("adult and family badges are consistent", () => {
  assert.equal(familyFitBadgeLabel({ adultOnly: true }), "Подходит Вам");
  assert.equal(familyFitBadgeLabel({ matchedChildNames: ["Тая"], allChildrenMatch: true, allowsAdults: true }), "Подходит Вам и Тае");
  assert.equal(familyFitBadgeLabel({ matchedChildNames: ["Тая", "Степан"] }), "Подходит Тае и Степану");
  assert.equal(familyFitBadgeLabel({ matchedChildNames: ["Степан", "Тая"], allowsAdults: true }), "Подходит Вам, Степану, Тае");
  assert.equal(familyFitBadgeLabel({ matchedChildNames: [] }), null);
  assert.equal(familyFitBadgeLabel({ matchedChildNames: ["Alex"] }), "Подходит ребёнку");
});
