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

/**
 * Pins the Step 1 rename: the semantic key stays `profile` (existing drafts
 * are keyed on it — see draftState.ts / PLACE_WIZARD_SCHEMA_VERSION), but
 * everything the user actually sees now reads "О месте" instead of the old
 * "Профиль" / "Профиль места".
 */
function testProfileStepIsRenamedToAboutThePlace() {
  assert.equal(
    PLACE_WIZARD_STEP_DEFINITIONS.profile.shortLabel,
    "О месте",
    "semantic key must stay 'profile' — only the visible copy changes",
  );
  assert.equal(PLACE_WIZARD_STEP_DEFINITIONS.profile.title, "О месте");

  // Position/order in the layout is unchanged — still step 1 in both layouts.
  assert.equal(getPlaceWizardStepKeys(false)[0], "profile");
  assert.equal(getPlaceWizardStepKeys(true)[0], "profile");
  assert.equal(getStepKey(1, false), "profile");
  assert.equal(getStepKey(1, true), "profile");
  assert.equal(getPlaceWizardStepNumber("profile", false), 1);
  assert.equal(getPlaceWizardStepNumber("profile", true), 1);
}

/**
 * Pins the Step 2 UX-copy update: the semantic key stays `location` and the
 * short/title copy stays "Локация" — only the description becomes
 * user-facing ("Укажите адрес — район и метро определим автоматически"
 * instead of the old bare "Где находится ваше место"). Order/position is
 * unchanged.
 */
function testLocationStepDescriptionIsUserFacing() {
  assert.equal(PLACE_WIZARD_STEP_DEFINITIONS.location.shortLabel, "Локация");
  assert.equal(PLACE_WIZARD_STEP_DEFINITIONS.location.title, "Локация");
  assert.equal(
    PLACE_WIZARD_STEP_DEFINITIONS.location.description,
    "Укажите адрес — район и метро определим автоматически",
  );

  // Position/order in the layout is unchanged — still step 2 in both layouts.
  assert.equal(getPlaceWizardStepKeys(false)[1], "location");
  assert.equal(getPlaceWizardStepKeys(true)[1], "location");
  assert.equal(getStepKey(2, false), "location");
  assert.equal(getStepKey(2, true), "location");
  assert.equal(getPlaceWizardStepNumber("location", false), 2);
  assert.equal(getPlaceWizardStepNumber("location", true), 2);
}

function main() {
  testLegacyLayoutIsStable();
  testCtaLayoutIsStable();
  testNumericIdsAreDerivedFromSemanticOrder();
  testSemanticLookupDoesNotDependOnNumericPosition();
  testStepCopyComesFromCanonicalDefinitions();
  testProfileStepIsRenamedToAboutThePlace();
  testLocationStepDescriptionIsUserFacing();
}

main();
console.log("place wizard config tests: OK");
