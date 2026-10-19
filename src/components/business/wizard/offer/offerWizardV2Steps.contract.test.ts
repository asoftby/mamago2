import assert from "node:assert/strict";
import { getDefaultFormData } from "./defaults";
import { V2_STEPS, V2_STEP_KEYS, getV2StepMembers, isV2CompositeStepKey } from "./offerWizardV2Steps";

const V2_KEYS = ["type", "about", "services", "schedule", "terms", "review"];

{
  // новый мастер: ровно 6 шагов в нужном порядке; составные — about/services/schedule/terms
  assert.deepEqual(V2_STEPS.map((s) => s.key), V2_KEYS);
  assert.deepEqual([...V2_STEP_KEYS], ["about", "services", "schedule", "terms"]);
  assert.ok(isV2CompositeStepKey("about"));
  assert.ok(!isV2CompositeStepKey("type"));
  assert.ok(!isV2CompositeStepKey("review"));
  for (const step of V2_STEPS) {
    assert.ok(step.title && step.shortLabel, `step ${step.key} has labels`);
  }
}

{
  // состав составных шагов
  const base = getDefaultFormData(null);
  assert.deepEqual(getV2StepMembers("about", { ...base, productType: "ONE_TIME_ACTIVITY" }), ["details", "photo"]);
  assert.deepEqual(getV2StepMembers("about", { ...base, productType: "PARTY_PACKAGE" }), ["placements", "details", "photo"]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, offerWizardType: "CAMP" }), ["campSchedule", "accommodation", "bookingMethod"]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, productType: "PARTY_SERVICE" }), ["openingHours", "bookingMethod"]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, productType: "REGULAR_ACTIVITY" }), [
    "conditions",
    "classSchedule",
    "bookingMethod",
  ]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, productType: "ONE_TIME_ACTIVITY" }), [
    "conditions",
    "classSchedule",
    "bookingMethod",
  ]);
  assert.deepEqual(getV2StepMembers("schedule", { ...base, productType: "PLACE_VISIT" }), [
    "conditions",
    "openingHours",
    "bookingMethod",
  ]);
  assert.deepEqual(getV2StepMembers("services", base), ["price"]);
  assert.deepEqual(getV2StepMembers("terms", base), ["contacts", "paymentTerms"]);
}

console.log("offerWizardV2Steps contract tests passed");
