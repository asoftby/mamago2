import assert from "node:assert/strict";
import test from "node:test";
import { AgePolicy } from "@prisma/client";
import { normalizeAgePolicy, selectAdultOnlyAge, selectSpecificAge, selectUnrestrictedAge } from "./agePolicy";

test("all four canonical policies normalize without conflation", () => {
  assert.deepEqual(normalizeAgePolicy({ agePolicy: AgePolicy.UNKNOWN }), { agePolicy: AgePolicy.UNKNOWN, ageTags: [], ageMinMonths: null, ageMaxMonths: null });
  assert.deepEqual(selectUnrestrictedAge(), { agePolicy: AgePolicy.UNRESTRICTED, ageTags: [] });
  assert.deepEqual(selectSpecificAge(["18+"]), { agePolicy: AgePolicy.SPECIFIC, ageTags: ["18+"] });
  assert.deepEqual(selectAdultOnlyAge(), { agePolicy: AgePolicy.ADULT_ONLY, ageTags: [] });
});

test("contradictions and inverted bounds fail closed", () => {
  assert.throws(() => normalizeAgePolicy({ agePolicy: AgePolicy.ADULT_ONLY, ageTags: ["18+"] }), /AGE_POLICY_CONTRADICTION/);
  assert.throws(() => normalizeAgePolicy({ agePolicy: AgePolicy.UNRESTRICTED, ageMinMonths: 0 }), /AGE_POLICY_CONTRADICTION/);
  assert.throws(() => normalizeAgePolicy({ agePolicy: AgePolicy.SPECIFIC }), /SPECIFIC_AGE_REQUIRED/);
  assert.throws(() => normalizeAgePolicy({ agePolicy: AgePolicy.SPECIFIC, ageMinMonths: 120, ageMaxMonths: 60 }), /INVALID_AGE_RANGE/);
});
