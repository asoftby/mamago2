import assert from "node:assert/strict";

import { buildEditableRouteWhereClause } from "./route.service";

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

function main() {
  testDefaultRestrictsToAuthor();
  testExplicitFalseRestrictsToAuthor();
  testAllowAnyAuthorDropsAuthorCheck();
}

main();
console.log("route.service tests: OK");
