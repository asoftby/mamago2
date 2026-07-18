import assert from "node:assert/strict";

import { resolvePlaceWizardSubmitAction } from "./resolvePlaceWizardSubmitAction";

function testCreateAlwaysCreate() {
  for (const status of ["DRAFT", "PENDING", "PUBLISHED", null, undefined] as const) {
    for (const userRole of ["USER", "BUSINESS_OWNER", "ADMIN", "MODERATOR", undefined] as const) {
      assert.equal(
        resolvePlaceWizardSubmitAction({ mode: "create", status, userRole }),
        "CREATE",
        `create mode must always resolve CREATE (status=${status}, role=${userRole})`,
      );
    }
  }
}

function testPendingAdminApproves() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "PENDING", userRole: "ADMIN" }),
    "APPROVE_PENDING",
  );
}

function testPendingModeratorApproves() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "PENDING", userRole: "MODERATOR" }),
    "APPROVE_PENDING",
  );
}

function testPendingBusinessOwnerForbidden() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "PENDING", userRole: "BUSINESS_OWNER" }),
    "FORBIDDEN",
  );
}

function testPendingUserForbidden() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "PENDING", userRole: "USER" }),
    "FORBIDDEN",
  );
}

function testPendingUndefinedRoleForbidden() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "PENDING", userRole: undefined }),
    "FORBIDDEN",
  );
}

function testDraftSubmitsExisting() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "DRAFT", userRole: "BUSINESS_OWNER" }),
    "SUBMIT_EXISTING",
  );
}

function testRejectedSubmitsExisting() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "REJECTED", userRole: "BUSINESS_OWNER" }),
    "SUBMIT_EXISTING",
  );
}

function testNeedsRevisionSubmitsExisting() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "NEEDS_REVISION", userRole: "BUSINESS_OWNER" }),
    "SUBMIT_EXISTING",
  );
}

/** Staff on a non-PENDING existing Place still just submits it — draft/rejected/needs-revision isn't an approval. */
function testDraftAdminAlsoSubmitsExisting() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "DRAFT", userRole: "ADMIN" }),
    "SUBMIT_EXISTING",
  );
}

function testPublishedAdminSavesDirect() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "PUBLISHED", userRole: "ADMIN" }),
    "SAVE_PUBLISHED_DIRECT",
  );
}

/**
 * Matches the PATCH endpoint's own gate exactly (`user.role !== "ADMIN"`
 * requires a revision) — MODERATOR is not exempt there, so it must not be
 * exempt here either.
 */
function testPublishedModeratorGoesThroughRevision() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "PUBLISHED", userRole: "MODERATOR" }),
    "SUBMIT_PUBLISHED_REVISION",
  );
}

function testPublishedBusinessOwnerGoesThroughRevision() {
  assert.equal(
    resolvePlaceWizardSubmitAction({ mode: "edit", status: "PUBLISHED", userRole: "BUSINESS_OWNER" }),
    "SUBMIT_PUBLISHED_REVISION",
  );
}

function main() {
  testCreateAlwaysCreate();
  testPendingAdminApproves();
  testPendingModeratorApproves();
  testPendingBusinessOwnerForbidden();
  testPendingUserForbidden();
  testPendingUndefinedRoleForbidden();
  testDraftSubmitsExisting();
  testRejectedSubmitsExisting();
  testNeedsRevisionSubmitsExisting();
  testDraftAdminAlsoSubmitsExisting();
  testPublishedAdminSavesDirect();
  testPublishedModeratorGoesThroughRevision();
  testPublishedBusinessOwnerGoesThroughRevision();
}

main();
console.log("resolvePlaceWizardSubmitAction tests: OK");
