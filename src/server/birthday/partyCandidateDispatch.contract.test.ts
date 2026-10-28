import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const dispatch = readFileSync("src/server/birthday/partyCandidateDispatch.service.ts", "utf8");
const confirm = readFileSync("src/server/birthday/partyConfirm.service.ts", "utf8");
for (const part of [
  'FROM "PartyOrderItem"', "FOR UPDATE", "selectPartyInvitationWave",
  "ANCHOR_CONFIRMED", "invitedBusinessIds", "activeBusinessIds",
  "verifyPartyOffers", "bookingRequest.create", "bookingActivity.create",
  "partyOutbox.create", '":sent"', "ReadCommitted",
]) assert.ok(dispatch.includes(part), "Missing dispatch guard: " + part);
assert.ok(confirm.includes("currentItem.confirmedBookingRequestId"),
  "second confirmation for one party item must be rejected");
assert.ok(confirm.includes('FROM "PartyOrderItem"'));
assert.ok(!dispatch.includes("export async function GET") && !dispatch.includes("export async function POST"),
  "dispatch must not be exposed before review of all competing reply transitions");
console.log("partyCandidateDispatch.contract.test.ts: OK");
