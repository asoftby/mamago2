import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const step = readFileSync("src/features/birthday/builder/components/steps/StepReview.tsx", "utf8");
for (const term of ['"/api/public/party-availability?"', "AbortController", "clearTimeout(timeout)", "setLastPreviewKey", "VENUE", "PACKAGE", "AVAILABLE", "UNAVAILABLE", "UNKNOWN", "Окончательно подтвердит исполнитель"]) {
  assert.ok(step.includes(term), "Missing safe preview UI contract: " + term);
}
assert.ok(step.includes("await submitBirthdayParty"), "existing submission must remain intact");
assert.ok(step.includes("onSent();"), "submission success handler must remain intact");
console.log("StepReviewAvailability.test.ts: OK");
