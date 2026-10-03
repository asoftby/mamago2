import assert from "node:assert/strict";
import test from "node:test";
import { resolvePlanOwner } from "./planOwner";

test("resolvePlanOwner maps a user to a user-scoped plan owner", () => {
  assert.deepEqual(resolvePlanOwner("user-1"), { userId: "user-1" });
});

test("resolvePlanOwner returns a fresh object per call", () => {
  const first = resolvePlanOwner("user-1");
  const second = resolvePlanOwner("user-1");
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
});
