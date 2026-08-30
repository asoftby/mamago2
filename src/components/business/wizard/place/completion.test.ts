import assert from "node:assert/strict";
import { AgePolicy } from "@prisma/client";

import { getDefaultFormData } from "./defaults";
import { getPlaceCompletion } from "./completion";

function assertAgeComplete(agePolicy: AgePolicy, ageTags: string[]) {
  const data = getDefaultFormData();
  data.ageTags = ageTags;
  data.agePolicy = agePolicy;

  const result = getPlaceCompletion(data);

  assert.equal(result.completedFields.includes("ageTags"), true);
  assert.equal(result.missingFields.some((item) => item.field === "ageTags"), false);
}

function assertAgeMissing(agePolicy: AgePolicy, ageTags: string[]) {
  const data = getDefaultFormData();
  data.ageTags = ageTags;
  data.agePolicy = agePolicy;

  const result = getPlaceCompletion(data);

  assert.equal(result.completedFields.includes("ageTags"), false);
  assert.equal(result.missingFields.some((item) => item.field === "ageTags"), true);
}

function testValidAgePoliciesCountAsComplete() {
  assertAgeComplete(AgePolicy.UNRESTRICTED, []);
  assertAgeComplete(AgePolicy.ADULT_ONLY, []);
  assertAgeComplete(AgePolicy.SPECIFIC, ["3-5"]);
  assertAgeComplete(AgePolicy.SPECIFIC, ["18+"]);
}

function testUnknownAndContradictoryAgeStatesRemainIncomplete() {
  assertAgeMissing(AgePolicy.UNKNOWN, []);
  assertAgeMissing(AgePolicy.SPECIFIC, []);
  assertAgeMissing(AgePolicy.UNRESTRICTED, ["3-5"]);
  assertAgeMissing(AgePolicy.ADULT_ONLY, ["18+"]);
}

function main() {
  testValidAgePoliciesCountAsComplete();
  testUnknownAndContradictoryAgeStatesRemainIncomplete();
}

main();
console.log("place completion tests: OK");
