import assert from "node:assert/strict";
import test from "node:test";
import { behaviorAffinityDelta } from "./behaviorSignalWeights";

test("child-specific HOME dismiss does not affect account-wide affinity", () => {
  assert.equal(behaviorAffinityDelta("DISMISS", { homeSelectedChildId: "child_0001" }), 0);
  assert.equal(behaviorAffinityDelta("DISMISS", { homeSelectedChildId: null }), -2);
  assert.equal(behaviorAffinityDelta("DISMISS", {}), -2);
  assert.equal(behaviorAffinityDelta("SAVE", { homeSelectedChildId: "child_0001" }), 2);
});
