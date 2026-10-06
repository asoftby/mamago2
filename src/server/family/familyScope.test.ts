import assert from "node:assert/strict";
import test from "node:test";

import {
  NOT_CANCELLED,
  childScopeWhere,
  familyReadsEnabled,
  planItemScopeWhere,
  sharedHistoryFromMembership,
} from "./familyScope";

test("FROM_JOIN: shared plan items are bounded by joinedAt, own items are not", () => {
  const joinedAt = new Date("2026-10-06T10:00:00Z");
  const scope = { userId: "u1", familyId: "f1", sharedHistoryFrom: joinedAt };
  assert.deepEqual(planItemScopeWhere(scope, true), {
    familyId: "f1",
    OR: [{ visibility: "FAMILY", createdAt: { gte: joinedAt } }, { userId: "u1" }],
  });
  // Children are not history-bounded: a child profile is current data, not history.
  assert.deepEqual(childScopeWhere(scope, true), { familyId: "f1" });
  // Flag off ignores the boundary (legacy owner scope).
  assert.deepEqual(planItemScopeWhere(scope, false), { userId: "u1" });
});

test("history boundary comes only from FROM_JOIN membership", () => {
  const joinedAt = new Date("2026-10-06T10:00:00Z");
  assert.equal(sharedHistoryFromMembership({ historyAccess: "FROM_JOIN", joinedAt }), joinedAt);
  assert.equal(sharedHistoryFromMembership({ historyAccess: "ALL", joinedAt }), null);
  const all = { userId: "u1", familyId: "f1", sharedHistoryFrom: null };
  assert.deepEqual(planItemScopeWhere(all, true), {
    familyId: "f1",
    OR: [{ visibility: "FAMILY" }, { userId: "u1" }],
  });
});

test("family reads flag is off by default and only 1/true turn it on", () => {
  assert.equal(familyReadsEnabled({}), false);
  assert.equal(familyReadsEnabled({ FAMILY_CORE_READS: "0" }), false);
  assert.equal(familyReadsEnabled({ FAMILY_CORE_READS: "1" }), true);
  assert.equal(familyReadsEnabled({ FAMILY_CORE_READS: " TRUE " }), true);
});

test("flag off: legacy owner scope (identical to pre-B2 behaviour)", () => {
  const scope = { userId: "u1", familyId: "f1" };
  assert.deepEqual(planItemScopeWhere(scope, false), { userId: "u1" });
  assert.deepEqual(childScopeWhere(scope, false), { parentId: "u1" });
});

test("flag on: ACL is familyId, never parentId/createdById", () => {
  const scope = { userId: "u1", familyId: "f1" };
  assert.deepEqual(childScopeWhere(scope, true), { familyId: "f1" });
  assert.deepEqual(planItemScopeWhere(scope, true), {
    familyId: "f1",
    OR: [{ visibility: "FAMILY" }, { userId: "u1" }],
  });
  assert.ok(!JSON.stringify(childScopeWhere(scope, true)).includes("parentId"));
  assert.ok(!JSON.stringify(childScopeWhere(scope, true)).includes("createdById"));
});

test("flag on without a family matches nothing", () => {
  const scope = { userId: "u1", familyId: null };
  assert.deepEqual(childScopeWhere(scope, true), { id: { in: [] } });
  assert.deepEqual(planItemScopeWhere(scope, true), { id: { in: [] } });
});

test("not-cancelled filter uses status, not cancelledAt", () => {
  assert.deepEqual(NOT_CANCELLED, { status: { not: "CANCELLED" } });
});
