import assert from "node:assert/strict";

import { validateStep1 } from "./validation";
import { getDefaultFormData } from "./defaults";
import type { PlaceFormData } from "./types";

function completeStep1Fixture(overrides: Partial<PlaceFormData> = {}): PlaceFormData {
  return {
    ...getDefaultFormData(),
    title: "Кофейня на Ленина",
    category: "кафе",
    primaryCategoryId: "cat-root-1",
    subcategoryIds: ["cat-child-1"],
    shortDesc: "Уютная кофейня",
    description: "<p>Подробное описание места на 20+ символов.</p>",
    visitFormats: ["family"],
    ageTags: [],
    ...overrides,
  };
}

/**
 * Regression: empty ageTags ("Любой возраст" — no age restriction) is a
 * valid, deliberate choice, not an incomplete field. Previously this was
 * rejected with "Выберите хотя бы один возраст".
 */
function testEmptyAgeTagsIsValid() {
  const result = validateStep1(completeStep1Fixture({ ageTags: [] }));
  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, []);
}

function testSpecificAgeTagsAreValid() {
  const result = validateStep1(completeStep1Fixture({ ageTags: ["3-5", "5-7"] }));
  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, []);
}

function testUnknownAgeTagIsRejected() {
  const result = validateStep1(completeStep1Fixture({ ageTags: ["not-a-real-age"] }));
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes("Неизвестные значения возраста")));
}

function testMixOfValidAndUnknownAgeTagIsRejected() {
  const result = validateStep1(completeStep1Fixture({ ageTags: ["3-5", "bogus"] }));
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes("bogus")));
}

/** Other Step 1 required-field checks are unaffected by the age change. */
function testOtherRequiredFieldsStillEnforced() {
  const result = validateStep1(completeStep1Fixture({ title: "" }));
  assert.equal(result.isValid, false);
  assert.ok(result.errors.includes("Название обязательно"));
}

function main() {
  testEmptyAgeTagsIsValid();
  testSpecificAgeTagsAreValid();
  testUnknownAgeTagIsRejected();
  testMixOfValidAndUnknownAgeTagIsRejected();
  testOtherRequiredFieldsStillEnforced();
}

main();
console.log("place wizard validation tests: OK");
