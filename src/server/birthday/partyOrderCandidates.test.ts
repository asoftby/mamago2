import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const service = readFileSync("src/server/birthday/partyOrderCandidates.service.ts", "utf8");
const route = readFileSync("src/app/api/parent/parties/[id]/candidates/route.ts", "utf8");
for (const part of ["ownerUserId", "findFirst", "findAvailablePartyCandidates", "excludedBusinessIds", "finalConfirmationRequired: true", "eventDate", "budgetByn"]) {
  assert.ok(service.includes(part), "Missing order-scoped matching contract: " + part);
}
for (const part of ["getCurrentUser()", "checkRateLimit", "querySchema.parse", "privatePartyResponse", "findCandidatesForParty(user.id"]) {
  assert.ok(route.includes(part), "Missing protected route contract: " + part);
}
assert.ok(!service.includes("bookingRequest.create") && !service.includes("partyOutbox.create"),
  "candidate lookup must remain read-only");
console.log("partyOrderCandidates.test.ts: OK");
