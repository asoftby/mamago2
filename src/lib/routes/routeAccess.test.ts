import assert from "node:assert/strict";
import type { RouteStatus, RouteVisibility } from "@prisma/client";

import { canViewRoute, type RouteAccessUser } from "./routeAccess";

const AUTHOR_ID = "author-1";

const ANON: RouteAccessUser | null = null;
const OTHER_USER: RouteAccessUser = { id: "user-2", role: "USER" };
const AUTHOR: RouteAccessUser = { id: AUTHOR_ID, role: "USER" };
const ADMIN: RouteAccessUser = { id: "admin-1", role: "ADMIN" };
const MODERATOR: RouteAccessUser = { id: "mod-1", role: "MODERATOR" };

const STATUSES: RouteStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const VISIBILITIES: RouteVisibility[] = ["PRIVATE", "UNLISTED", "PUBLIC"];

// [status, visibility, anon, other, author, admin, moderator]
const TABLE: Array<[RouteStatus, RouteVisibility, boolean, boolean, boolean, boolean, boolean]> = [
  ["PUBLISHED", "PUBLIC", true, true, true, true, true],
  ["PUBLISHED", "UNLISTED", true, true, true, true, true],
  ["PUBLISHED", "PRIVATE", false, false, true, true, true],
  ["DRAFT", "PUBLIC", false, false, true, true, true],
  ["DRAFT", "UNLISTED", false, false, true, true, true],
  ["DRAFT", "PRIVATE", false, false, true, true, true],
  ["ARCHIVED", "PUBLIC", false, false, true, true, true],
  ["ARCHIVED", "UNLISTED", false, false, true, true, true],
  ["ARCHIVED", "PRIVATE", false, false, true, true, true],
];

function testFullMatrix() {
  // Every (status, visibility) pair must appear in TABLE exactly once —
  // guards the table itself against a missed combination.
  assert.equal(TABLE.length, STATUSES.length * VISIBILITIES.length);
  for (const status of STATUSES) {
    for (const visibility of VISIBILITIES) {
      assert.ok(
        TABLE.some(([s, v]) => s === status && v === visibility),
        `missing table row for ${status}/${visibility}`,
      );
    }
  }

  for (const [status, visibility, anon, other, author, admin, moderator] of TABLE) {
    const route = { status, visibility, authorId: AUTHOR_ID };
    const label = `${status}/${visibility}`;
    assert.equal(canViewRoute(route, ANON), anon, `${label} anon`);
    assert.equal(canViewRoute(route, OTHER_USER), other, `${label} other`);
    assert.equal(canViewRoute(route, AUTHOR), author, `${label} author`);
    assert.equal(canViewRoute(route, ADMIN), admin, `${label} admin`);
    assert.equal(canViewRoute(route, MODERATOR), moderator, `${label} moderator`);
  }
}

function testAuthorlessEditorialRouteOnlyVisibleToAdminModerator() {
  // Imported/editorial routes: authorId === null. No regular user — not
  // even one whose id happens to be compared — can ever match `authorId`,
  // so only admin/moderator can preview a non-public one.
  const route = { status: "DRAFT" as const, visibility: "PRIVATE" as const, authorId: null };
  assert.equal(canViewRoute(route, ANON), false);
  assert.equal(canViewRoute(route, OTHER_USER), false);
  assert.equal(canViewRoute(route, ADMIN), true);
  assert.equal(canViewRoute(route, MODERATOR), true);
}

function main() {
  testFullMatrix();
  testAuthorlessEditorialRouteOnlyVisibleToAdminModerator();
}

main();
console.log("routeAccess tests: OK");
