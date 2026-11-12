import assert from "node:assert/strict";
import { getDefaultFormData } from "./defaults";
import { validateStep } from "./validation";

const base = getDefaultFormData();
base.pricingMode = "free";
base.participationMode = "prebook";
base.prebookPhone = "";
base.prebookUrl = "";

const native = validateStep(6, { ...base, prebookMethod: "internal" });
assert.equal(native.isValid, true);
assert.equal(native.isComplete, true, "native prebooking must allow forward navigation without external contacts");
assert.deepEqual(native.errors, []);

for (const method of ["phone", "link", null] as const) {
  const result = validateStep(6, { ...base, prebookMethod: method });
  assert.equal(result.isComplete, false, "external modes still require their destination");
  assert.equal(result.isValid, false);
}
assert.equal(validateStep(6, { ...base, prebookMethod: "phone", prebookPhone: "+375291112233" }).isComplete, true);
assert.equal(validateStep(6, { ...base, prebookMethod: "link", prebookUrl: "https://example.test/signup" }).isComplete, true);
console.log("Native prebooking wizard completion and external guards: PASS");
