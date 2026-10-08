import assert from "node:assert/strict";
import test from "node:test";
import { buildMeProfileUpdateData } from "./buildMeProfileUpdateData";

test("familyRole null and empty string explicitly clear the role", () => {
  assert.deepEqual(buildMeProfileUpdateData({ familyRole: null }), { familyRole: null });
  assert.deepEqual(buildMeProfileUpdateData({ familyRole: "" }), { familyRole: null });
});

test("omitted familyRole remains untouched", () => {
  assert.equal("familyRole" in buildMeProfileUpdateData({}), false);
});

test("clearing familyRole never implicitly touches legacy ageBandLabel", () => {
  const update = buildMeProfileUpdateData({ familyRole: null });
  assert.equal("ageBandLabel" in update, false);
});
