import assert from "node:assert/strict";

import { canEditPlaceInWizard } from "./canEditPlaceInWizard";

function testCreateModeAlwaysEditable() {
  for (const status of ["DRAFT", "PENDING", "PUBLISHED", null, undefined] as const) {
    for (const userRole of ["USER", "BUSINESS_OWNER", "ADMIN", "MODERATOR", undefined] as const) {
      assert.equal(
        canEditPlaceInWizard({ mode: "create", status, userRole }),
        true,
        `create mode must always be editable (status=${status}, role=${userRole})`,
      );
    }
  }
}

function testEditNonPendingUnchangedForAllRoles() {
  for (const status of ["DRAFT", "PUBLISHED"] as const) {
    for (const userRole of ["USER", "BUSINESS_OWNER", "ADMIN", "MODERATOR", undefined] as const) {
      assert.equal(
        canEditPlaceInWizard({ mode: "edit", status, userRole }),
        true,
        `edit + ${status} must stay editable regardless of role (existing behavior)`,
      );
    }
  }
}

function testEditPendingAdminIsEditable() {
  assert.equal(canEditPlaceInWizard({ mode: "edit", status: "PENDING", userRole: "ADMIN" }), true);
}

function testEditPendingModeratorIsEditable() {
  assert.equal(canEditPlaceInWizard({ mode: "edit", status: "PENDING", userRole: "MODERATOR" }), true);
}

function testEditPendingBusinessOwnerIsReadOnly() {
  assert.equal(canEditPlaceInWizard({ mode: "edit", status: "PENDING", userRole: "BUSINESS_OWNER" }), false);
}

function testEditPendingUserIsReadOnly() {
  assert.equal(canEditPlaceInWizard({ mode: "edit", status: "PENDING", userRole: "USER" }), false);
}

function testEditPendingUndefinedRoleIsReadOnly() {
  assert.equal(canEditPlaceInWizard({ mode: "edit", status: "PENDING", userRole: undefined }), false);
}

function main() {
  testCreateModeAlwaysEditable();
  testEditNonPendingUnchangedForAllRoles();
  testEditPendingAdminIsEditable();
  testEditPendingModeratorIsEditable();
  testEditPendingBusinessOwnerIsReadOnly();
  testEditPendingUserIsReadOnly();
  testEditPendingUndefinedRoleIsReadOnly();
}

main();
console.log("canEditPlaceInWizard tests: OK");
