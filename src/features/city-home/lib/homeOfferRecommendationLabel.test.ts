import assert from "node:assert/strict";
import test from "node:test";
import { homeOfferRecommendationLabel as label } from "./homeOfferRecommendationLabel";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
const adult: FamilyPersona = { id: "adult", kind: "adult", displayName: "Я" };
const kid = (id: string, birthDate: string | null): FamilyPersona => ({
  id, kind: "child", displayName: id, birthDate,
});
test("no age evidence never claims child suitability", () => {
  assert.equal(label({ agePolicy: "UNKNOWN", ageFrom: 0, ageTo: 18 },
    [adult, kid("Степан", null)]), null);
});
test("specific age fit names verified children and not mismatches", () => {
  const people = [adult, kid("Степан", "2021-01-01"), kid("Тая", "2018-01-01")];
  assert.equal(label({ agePolicy: "SPECIFIC", ageFrom: 3, ageTo: 6 }, people), "Подходит: Степан");
});
test("unrestricted classes fit the whole family; adult-only classes are for adult", () => {
  const people = [adult, kid("Степан", "2021-01-01")];
  assert.equal(label({ agePolicy: "UNRESTRICTED", ageFrom: 0, ageTo: 99 }, people), "Подходит всей семье");
  assert.equal(label({ agePolicy: "ADULT_ONLY", ageFrom: 18, ageTo: 99 }, people), "Подходит вам");
});
