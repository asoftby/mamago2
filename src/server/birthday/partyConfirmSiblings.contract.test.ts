import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("src/server/birthday/partyConfirm.service.ts", "utf8");
const itemLock = source.indexOf('FROM "PartyOrderItem"');
const winnerClaim = source.indexOf('confirmedBookingRequestId: requestId');
const siblingQuery = source.indexOf("const competing = await tx.bookingRequest.findMany");
assert.ok(itemLock >= 0 && winnerClaim > itemLock && siblingQuery > winnerClaim);
for (const token of ["id: { not: requestId }", "status: BookingStatus.NEW",
  'partyStage: "NOT_ACCEPTED"', 'partyCloseReason: "NOT_SELECTED"',
  "partyQuote.updateMany", "REQUEST_WITHDRAWN", "partyOutbox.create",
  '":not-selected"']) assert.ok(source.includes(token), token);
console.log("partyConfirmSiblings.contract.test.ts: OK");
