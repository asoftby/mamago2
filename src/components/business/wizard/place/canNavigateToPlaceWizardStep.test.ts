import assert from "node:assert/strict";

import { canNavigateToPlaceWizardStep } from "./canNavigateToPlaceWizardStep";

const RANGE = { firstStep: 1, totalSteps: 6 };

function testEditPendingAllowsJumpingAhead() {
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "edit", currentStep: 1, targetStep: 4, ...RANGE }),
    true,
  );
}

function testEditDraftAllowsJumpingToLastStep() {
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "edit", currentStep: 1, targetStep: 6, ...RANGE }),
    true,
  );
}

function testEditPublishedKeepsFreeNavigation() {
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "edit", currentStep: 2, targetStep: 5, ...RANGE }),
    true,
  );
}

function testEditAllowsGoingBackward() {
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "edit", currentStep: 5, targetStep: 1, ...RANGE }),
    true,
  );
}

function testAdminAndEditorCanJumpToIncompleteSteps() {
  for (const role of ["ADMIN", "EDITOR"] as const) {
    assert.equal(
      canNavigateToPlaceWizardStep({
        mode: "create",
        role,
        currentStep: 1,
        targetStep: 6,
        ...RANGE,
      }),
      true,
    );
  }
}

function testOtherRolesCannotJumpToIncompleteSteps() {
  for (const role of ["BUSINESS", "MODERATOR", "USER"] as const) {
    assert.equal(
      canNavigateToPlaceWizardStep({
        mode: "create",
        role,
        currentStep: 1,
        targetStep: 6,
        ...RANGE,
      }),
      false,
    );
  }
}

function testCreateForbidsJumpingAhead() {
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "create", currentStep: 1, targetStep: 4, ...RANGE }),
    false,
  );
}

function testCreateAllowsNextStep() {
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "create", currentStep: 1, targetStep: 2, ...RANGE }),
    true,
  );
}

function testCreateAllowsGoingBackward() {
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "create", currentStep: 3, targetStep: 1, ...RANGE }),
    true,
  );
}

function testInvalidStepBelowRangeForbidden() {
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "edit", currentStep: 3, targetStep: 0, ...RANGE }),
    false,
  );
}

function testInvalidStepAboveRangeForbidden() {
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "edit", currentStep: 3, targetStep: 7, ...RANGE }),
    false,
  );
}

function main() {
  testEditPendingAllowsJumpingAhead();
  testEditDraftAllowsJumpingToLastStep();
  testEditPublishedKeepsFreeNavigation();
  testEditAllowsGoingBackward();
  testAdminAndEditorCanJumpToIncompleteSteps();
  testOtherRolesCannotJumpToIncompleteSteps();
  testCreateForbidsJumpingAhead();
  testCreateAllowsNextStep();
  testCreateAllowsGoingBackward();
  assert.equal(
    canNavigateToPlaceWizardStep({ mode: "create", role: "ADMIN", currentStep: 1, targetStep: 7, ...RANGE }),
    false,
  );
  testInvalidStepBelowRangeForbidden();
  testInvalidStepAboveRangeForbidden();
}

main();
console.log("canNavigateToPlaceWizardStep tests: OK");
