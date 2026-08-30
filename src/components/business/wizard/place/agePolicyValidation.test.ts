import assert from "node:assert/strict";
import { AgePolicy } from "@prisma/client";

import { getDefaultFormData } from "./defaults";
import { validateStep1 } from "./validation";

function makeOtherwiseValidStep1() {
  const data = getDefaultFormData();
  data.title = "Тестовое место";
  data.category = "kids-center";
  data.primaryCategoryId = "category-id";
  data.subcategoryIds = ["subcategory-id"];
  data.shortDesc = "Короткое описание";
  data.description = "Полное описание";
  data.visitFormats = ["format-indoor"];
  return data;
}

function testUnrestrictedIsValid() {
  const data = makeOtherwiseValidStep1();
  data.agePolicy = AgePolicy.UNRESTRICTED;
  data.ageTags = [];
  assert.equal(validateStep1(data).isValid, true);
}

function testAdultOnlyIsValid() {
  const data = makeOtherwiseValidStep1();
  data.agePolicy = AgePolicy.ADULT_ONLY;
  data.ageTags = [];
  assert.equal(validateStep1(data).isValid, true);
}

function testSpecific18PlusSuitabilityIsValid() {
  const data = makeOtherwiseValidStep1();
  data.agePolicy = AgePolicy.SPECIFIC;
  data.ageTags = ["18+"];
  assert.equal(validateStep1(data).isValid, true);
}

function testUnknownIsIncomplete() {
  const data = makeOtherwiseValidStep1();
  data.agePolicy = AgePolicy.UNKNOWN;
  data.ageTags = [];
  const result = validateStep1(data);
  assert.equal(result.isValid, false);
  assert.equal(result.errors.includes("Выберите возраст"), true);
}

function testContradictoryPolicyIsIncomplete() {
  const data = makeOtherwiseValidStep1();
  data.agePolicy = AgePolicy.ADULT_ONLY;
  data.ageTags = ["18+"];
  const result = validateStep1(data);
  assert.equal(result.isValid, false);
  assert.equal(result.errors.includes("Проверьте возрастные ограничения"), true);
}

function main() {
  testUnrestrictedIsValid();
  testAdultOnlyIsValid();
  testSpecific18PlusSuitabilityIsValid();
  testUnknownIsIncomplete();
  testContradictoryPolicyIsIncomplete();
}

main();
console.log("place age policy validation tests: OK");
