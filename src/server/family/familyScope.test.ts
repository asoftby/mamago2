import assert from "node:assert/strict";
import test from "node:test";

import { NOT_CANCELLED, childScopeWhere, familyReadsEnabled, planItemScopeWhere } from "./familyScope";

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
