import assert from "node:assert/strict";
import test from "node:test";
import { resolvePlanOwner } from "./planOwner";

test("resolvePlanOwner carries the active family id", async () => {
  const owner = await resolvePlanOwner("user-1", { findActiveFamilyId: async () => "fam-1" });
  assert.deepEqual(owner, { userId: "user-1", familyId: "fam-1" });
});

test("resolvePlanOwner has a null family before the family exists", async () => {
  const owner = await resolvePlanOwner("user-1", { findActiveFamilyId: async () => null });
  assert.deepEqual(owner, { userId: "user-1", familyId: null });
});

test("resolvePlanOwner returns a fresh object per call", async () => {
  const deps = { findActiveFamilyId: async () => "fam-1" };
  const first = await resolvePlanOwner("user-1", deps);
  const second = await resolvePlanOwner("user-1", deps);
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
});
