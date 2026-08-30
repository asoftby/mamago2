import assert from "node:assert/strict";

import {
  PLACE_WIZARD_STEP_DEFINITIONS,
  getPlaceWizardStepKeys,
  getPlaceWizardStepNumber,
  getPlaceWizardSteps,
  getPlaceWizardTotalSteps,
  getStepKey,
} from "./config";

function testLegacyLayoutIsStable() {
  assert.deepEqual(getPlaceWizardStepKeys(false), [
    "profile",
    "location",
    "contacts",
    "photos",
    "openingHours",
    "faq",
    "review",
  ]);
  assert.equal(getPlaceWizardTotalSteps(false), 7);
}

function testCtaLayoutIsStable() {
  assert.deepEqual(getPlaceWizardStepKeys(true), [
    "profile",
    "location",
    "contacts",
    "photos",
    "openingHours",
    "cta",
    "faq",
    "review",
  ]);
  assert.equal(getPlaceWizardTotalSteps(true), 8);
}

function testNumericIdsAreDerivedFromSemanticOrder() {
  const legacy = getPlaceWizardSteps(false);
  const withCta = getPlaceWizardSteps(true);

  assert.deepEqual(legacy.map((step) => step.id), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(withCta.map((step) => step.id), [1, 2, 3, 4, 5, 6, 7, 8]);

  assert.equal(getStepKey(6, false), "faq");
  assert.equal(getStepKey(6, true), "cta");
  assert.equal(getStepKey(7, true), "faq");
  assert.equal(getStepKey(8, true), "review");
}

function testSemanticLookupDoesNotDependOnNumericPosition() {
  assert.equal(getPlaceWizardStepNumber("faq", false), 6);
  assert.equal(getPlaceWizardStepNumber("faq", true), 7);
  assert.equal(getPlaceWizardStepNumber("review", false), 7);
  assert.equal(getPlaceWizardStepNumber("review", true), 8);
  assert.equal(getPlaceWizardStepNumber("cta", false), null);
  assert.equal(getPlaceWizardStepNumber("cta", true), 6);
}

function testStepCopyComesFromCanonicalDefinitions() {
  for (const step of getPlaceWizardSteps(true)) {
    const definition = PLACE_WIZARD_STEP_DEFINITIONS[step.key];
    assert.equal(step.shortLabel, definition.shortLabel);
    assert.equal(step.label, definition.shortLabel);
    assert.equal(step.title, definition.title);
    assert.equal(step.description, definition.description);
  }
}

function main() {
  testLegacyLayoutIsStable();
  testCtaLayoutIsStable();
  testNumericIdsAreDerivedFromSemanticOrder();
  testSemanticLookupDoesNotDependOnNumericPosition();
  testStepCopyComesFromCanonicalDefinitions();
}

main();
console.log("place wizard config tests: OK");
