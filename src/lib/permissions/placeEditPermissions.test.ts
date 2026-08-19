import assert from "node:assert/strict";

import { canEditPendingPlace } from "./placeEditPermissions";

function testAdminCanEditPending() {
  assert.equal(canEditPendingPlace("ADMIN"), true);
}

function testModeratorCanEditPending() {
  assert.equal(canEditPendingPlace("MODERATOR"), true);
}

function testBusinessOwnerCannotEditPending() {
  assert.equal(canEditPendingPlace("BUSINESS_OWNER"), false);
}

function testUserCannotEditPending() {
  assert.equal(canEditPendingPlace("USER"), false);
}

function testUndefinedRoleCannotEditPending() {
  assert.equal(canEditPendingPlace(undefined), false);
}

function main() {
  testAdminCanEditPending();
  testModeratorCanEditPending();
  testBusinessOwnerCannotEditPending();
  testUserCannotEditPending();
  testUndefinedRoleCannotEditPending();
}

main();
console.log("placeEditPermissions tests: OK");
