import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("src/server/birthday/partyCandidateRanking.ts", "utf8");
for (const key of ["getPublicPublishedOfferWhere()", 'status: "APPROVED"', "minChildren", "maxChildren", "ageMinMonths", "ageMaxMonths", "ownerBusinessId", "new Map<string, RankedPartyCandidate>()", "while (true)", "cursor:", "slice(0, 5)", "excluded.has(businessId)"]) {
  assert.ok(source.includes(key), "Missing matching contract: " + key);
}
assert.ok(source.indexOf("slice(0, 5)") > source.indexOf("while (true)"),
  "limit five after scanning, never at database discovery");
assert.ok(!source.includes("bookingRequest.create") && !source.includes("partyOutbox.create"),
  "ranking must not dispatch invitations");
console.log("partyCandidateRanking.test.ts: OK");
