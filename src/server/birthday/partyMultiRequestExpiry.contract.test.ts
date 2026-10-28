import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("src/server/birthday/partyRequestExpiry.service.ts", "utf8");
assert.equal((source.match(/settleExpiredPartyItem\(tx, request\.partyOrderItem\.id/g) ?? []).length, 2,
  "both request and quote expiry must preserve sibling invitations");
assert.ok(source.includes('FROM "PartyOrderItem"') && source.includes("FOR UPDATE"));
assert.ok(source.includes("partyOrderItemId: itemId"));
assert.ok(source.includes('["SENT", "QUOTED", "AWAITING_RECONFIRM"]'));
assert.ok(source.includes("confirmedBookingRequestId"));
assert.ok(source.includes("if (active > 0)"));
console.log("partyMultiRequestExpiry.contract.test.ts: OK");
