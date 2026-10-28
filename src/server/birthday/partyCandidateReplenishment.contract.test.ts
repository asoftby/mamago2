import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const matching = readFileSync("src/server/birthday/partyOrderCandidates.service.ts", "utf8");
const dispatch = readFileSync("src/server/birthday/partyCandidateDispatch.service.ts", "utf8");
assert.ok(matching.includes("additionalExcludedBusinessIds"));
assert.ok(matching.includes("...additionalExcludedBusinessIds"));
assert.ok(matching.indexOf("...additionalExcludedBusinessIds") < matching.indexOf("findAvailablePartyCandidates({"),
  "past invitees must be excluded before ranking and availability");
assert.ok(dispatch.includes("partyOrderItemId: input.itemId"));
assert.ok(dispatch.includes("historical.map(request => request.businessId)"));
assert.ok(dispatch.includes("invitedBusinessIds = current.requests.map"));
assert.ok(dispatch.includes("current.confirmedBookingRequestId"));
console.log("partyCandidateReplenishment.contract.test.ts: OK");
