import assert from "node:assert/strict";

import { offerStatusRequiresPlace } from "./offerPlaceRequirement";

function main() {
  assert.equal(offerStatusRequiresPlace("DRAFT"), false, "DRAFT may exist without a Place");
  assert.equal(offerStatusRequiresPlace("PENDING"), true, "PENDING requires a Place");
  assert.equal(offerStatusRequiresPlace("PUBLISHED"), true, "PUBLISHED requires a Place");
  assert.equal(offerStatusRequiresPlace("REJECTED"), false, "REJECTED (moderation-rejected, not a submission state) does not require a Place");
}

main();
console.log("offerPlaceRequirement tests: OK");
