import assert from "node:assert/strict";

import { canFreelyNavigateWizard } from "./canFreelyNavigateWizard";

assert.equal(canFreelyNavigateWizard("ADMIN"), true);
assert.equal(canFreelyNavigateWizard("MODERATOR"), true);
for (const role of ["BUSINESS_OWNER", "USER"] as const) {
  assert.equal(canFreelyNavigateWizard(role), false);
}
assert.equal(canFreelyNavigateWizard(undefined), false);
assert.equal(canFreelyNavigateWizard(null), false);
console.log("canFreelyNavigateWizard tests: OK");
