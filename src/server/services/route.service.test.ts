import assert from "node:assert/strict";

import { buildEditableRouteWhereClause, canWriteRoute } from "./route.service";

function testDefaultRestrictsToAuthor() {
  assert.deepEqual(buildEditableRouteWhereClause("route-1", "user-1"), {
    id: "route-1",
    authorId: "user-1",
  });
}

function testExplicitFalseRestrictsToAuthor() {
  assert.deepEqual(buildEditableRouteWhereClause("route-1", "user-1", { allowAnyAuthor: false }), {
    id: "route-1",
    authorId: "user-1",
  });
}

function testAllowAnyAuthorDropsAuthorCheck() {
  // Admin/moderator surface: any route, including authorless editorial
  // routes (imported WordPress routes have authorId === null) — the where
  // clause must not filter on authorId at all, not even authorId: null.
  const where = buildEditableRouteWhereClause("route-1", "user-1", { allowAnyAuthor: true });
  assert.deepEqual(where, { id: "route-1" });
  assert.ok(!("authorId" in where));
}

// `canWriteRoute` guards the PATCH /api/routes/[id] save path (updateRoute).
// Regression coverage for the reviewed admin-save-path flow: an authorless
// editorial route (imported from WordPress, authorId === null) can only be
// saved by ADMIN/MODERATOR via `allowAnyAuthor`, never by an arbitrary user.

function testOwnerCanWriteOwnRoute() {
  assert.equal(canWriteRoute("user-1", "user-1"), true);
}

function testOtherUserCannotWriteForeignRoute() {
  assert.equal(canWriteRoute("user-1", "user-2"), false);
}

function testOtherUserCannotWriteAuthorlessRouteWithoutBypass() {
  // authorId === null (imported editorial route): a plain user must still
  // be rejected — allowAnyAuthor is required, not just a null authorId.
  assert.equal(canWriteRoute(null, "user-2"), false);
}

function testPrivilegedEditorCanWriteForeignRouteWithBypass() {
  assert.equal(canWriteRoute("user-1", "admin-1", { allowAnyAuthor: true }), true);
}

function testPrivilegedEditorCanWriteAuthorlessRouteWithBypass() {
  assert.equal(canWriteRoute(null, "admin-1", { allowAnyAuthor: true }), true);
}

function testExplicitFalseBypassStillRestrictsToAuthor() {
  assert.equal(canWriteRoute("user-1", "user-2", { allowAnyAuthor: false }), false);
}

function main() {
  testDefaultRestrictsToAuthor();
  testExplicitFalseRestrictsToAuthor();
  testAllowAnyAuthorDropsAuthorCheck();
  testOwnerCanWriteOwnRoute();
  testOtherUserCannotWriteForeignRoute();
  testOtherUserCannotWriteAuthorlessRouteWithoutBypass();
  testPrivilegedEditorCanWriteForeignRouteWithBypass();
  testPrivilegedEditorCanWriteAuthorlessRouteWithBypass();
  testExplicitFalseBypassStillRestrictsToAuthor();
}

main();
console.log("route.service tests: OK");
