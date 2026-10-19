import assert from "node:assert/strict";

import { canFreelyNavigateWizard } from "./canFreelyNavigateWizard";

assert.equal(canFreelyNavigateWizard("ADMIN"), true);
assert.equal(canFreelyNavigateWizard("EDITOR"), true);
for (const role of ["BUSINESS", "MODERATOR", "USER"] as const) {
  assert.equal(canFreelyNavigateWizard(role), false);
}
assert.equal(canFreelyNavigateWizard(undefined), false);
assert.equal(canFreelyNavigateWizard(null), false);
console.log("canFreelyNavigateWizard tests: OK");
