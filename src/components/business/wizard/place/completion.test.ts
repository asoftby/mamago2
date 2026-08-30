import assert from "node:assert/strict";
import { AgePolicy } from "@prisma/client";

import { getDefaultFormData } from "./defaults";
import { getPlaceCompletion } from "./completion";

function testUnrestrictedAgeCountsAsComplete() {
  const data = getDefaultFormData();
  data.ageTags = [];
  data.agePolicy = AgePolicy.UNRESTRICTED;

  const result = getPlaceCompletion(data);

  assert.equal(result.completedFields.includes("ageTags"), true);
  assert.equal(result.missingFields.some((item) => item.field === "ageTags"), false);
}

function testAdultOnlyAgeCountsAsComplete() {
  const data = getDefaultFormData();
  data.ageTags = [];
  data.agePolicy = AgePolicy.ADULT_ONLY;

  const result = getPlaceCompletion(data);

  assert.equal(result.completedFields.includes("ageTags"), true);
  assert.equal(result.missingFields.some((item) => item.field === "ageTags"), false);
}

function testSpecificAgeCountsAsComplete() {
  const data = getDefaultFormData();
  data.ageTags = ["3-5"];
  data.agePolicy = AgePolicy.SPECIFIC;

  const result = getPlaceCompletion(data);

  assert.equal(result.completedFields.includes("ageTags"), true);
  assert.equal(result.missingFields.some((item) => item.field === "ageTags"), false);
}

function main() {
  testUnrestrictedAgeCountsAsComplete();
  testAdultOnlyAgeCountsAsComplete();
  testSpecificAgeCountsAsComplete();
}

main();
console.log("place completion tests: OK");
