import assert from "node:assert/strict";
import test from "node:test";
import { homeOfferRecommendationLabel as label } from "./homeOfferRecommendationLabel";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
const adult: FamilyPersona = { id: "adult", kind: "adult", displayName: "Я" };
const kid = (id: string, birthDate: string | null): FamilyPersona => ({ id, kind: "child", displayName: id, birthDate });
const people = [adult, kid("Степан", "2021-01-01"), kid("Тая", "2018-01-01")];
test("age and adult eligibility never create badges without independent evidence", () => {
  assert.equal(label({ agePolicy: "SPECIFIC", ageFrom: 3, ageTo: 6 }, people), null);
  assert.equal(label({ agePolicy: "UNRESTRICTED", ageFrom: 0, ageTo: 99 }, people), null);
  assert.equal(label({ agePolicy: "ADULT_ONLY", ageFrom: 18, ageTo: 99 }, people, ["Степан"]), null);
});
test("only verified participants who also meet age constraints appear", () => {
  assert.equal(label({ agePolicy: "SPECIFIC", ageFrom: 3, ageTo: 6 }, people, ["Степан", "Тая"]), "Подходит Степану");
  assert.equal(label({ agePolicy: "UNRESTRICTED", ageFrom: 0, ageTo: 99 }, people, ["Степан", "Тая"]), "Подходит Степану и Тае");
  assert.equal(label({ agePolicy: "SPECIFIC", ageFrom: 3, ageTo: 6 }, [kid("Степан", null)], ["Степан"]), null);
});
