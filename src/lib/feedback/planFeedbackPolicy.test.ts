import assert from "node:assert/strict";
import { requiresVerifiedPhoneForPlanFeedback } from "./planFeedbackPolicy";

assert.equal(requiresVerifiedPhoneForPlanFeedback({ feedbackV1Enabled: false, comment: null }), true);
assert.equal(requiresVerifiedPhoneForPlanFeedback({ feedbackV1Enabled: true, comment: null }), false);
assert.equal(requiresVerifiedPhoneForPlanFeedback({ feedbackV1Enabled: true, comment: "" }), false);
assert.equal(requiresVerifiedPhoneForPlanFeedback({ feedbackV1Enabled: true, comment: "   " }), false);
assert.equal(requiresVerifiedPhoneForPlanFeedback({ feedbackV1Enabled: true, comment: "Классно" }), true);
assert.equal(requiresVerifiedPhoneForPlanFeedback({ feedbackV1Enabled: false, comment: "Классно" }), true);
console.log("✅ plan feedback verification policy");
