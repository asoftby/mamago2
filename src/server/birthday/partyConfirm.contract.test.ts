import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partyOutboxCopy, isPartyOutboxEventType } from "./partyOutbox.logic";

const confirmService = readFileSync(new URL("./partyConfirm.service.ts", import.meta.url), "utf8");
const fanout = readFileSync(new URL("./partyAddonFanout.ts", import.meta.url), "utf8");
const unitAllocation = readFileSync(new URL("./partyUnitAllocation.ts", import.meta.url), "utf8");
// The add-on fan-out and the locked unit check are shared with the fixed-price
// auto-confirmation; check them together with the confirmation service.
const service = confirmService + fanout + unitAllocation;
assert.match(confirmService, /window = await lockAvailablePartyUnit\(tx, \{/);
assert.match(confirmService, /await allocatePartyUnit\(tx, \{ unitId: unit\.id, requestId, quoteId: quote\.id, window \}\)/);
assert.match(confirmService, /isAnchor \? await requestPartyAddonsAfterAnchor\(tx,/);
// Claim PLANNED → REQUESTED before creating the request: a repeat cannot double-request an item.
assert.ok(fanout.indexOf("status: PartyItemStatus.REQUESTED") < fanout.indexOf("tx.bookingRequest.create"));
assert.match(fanout, /if \(claimed\.count !== 1\) continue;/);
const route = readFileSync(new URL("../../app/api/business/party-requests/[id]/confirm/route.ts", import.meta.url), "utf8");

for (const invariant of [
  'partyStage: "AWAITING_RECONFIRM"',
  'quote.status !== "ACCEPTED"',
  "quote.version !== expectedQuoteVersion",
  "quote.decidedByUserId !== order.ownerUserId",
  "responseDueAt: { gt: now }",
  "lastActivityAt: req.lastActivityAt",
  'partyStage: "CONFIRMED"',
  "tx.bookingUnitOffer.findMany",
  "FOR UPDATE",
  "tx.calendarBlock.findFirst",
  "tx.bookingAllocation.findFirst",
  'status: "CONFIRMED"',
  "tx.partyOrderItem.update",
  "confirmedBookingRequestId: requestId",
  'role: PartyItemRole.INCLUDED',
  'role: { in: [PartyItemRole.ADDON, PartyItemRole.STANDALONE] }',
  'eventType: "PARTY_REQUEST_SENT"',
  'eventType: "PARTY_BOOKING_CONFIRMED"',
  "idempotencyKey",
  "dedupeKey",
  "verifyPartyOffers",
  "offerPriceSnapshot: quote.priceByn",
  "BookingAllocation_no_active_overlap",
]) {
  assert.ok(service.includes(invariant), "Missing invariant: " + invariant);
}
assert.match(route, /getMyBusiness\(user.id\)/);


assert.match(service, /const venueRequired = isAnchor/);
assert.match(service, /locked.status !== "ACTIVE"/);
assert.match(service, /bookingUnitId_offerId/);
assert.match(service, /PartyItemRole.STANDALONE/);
assert.match(service, /responseDueAt: \{ gt: now \}/);
const reserveSlotSql = readFileSync(new URL("../offers/reserveSlot.ts", import.meta.url), "utf8");
for (const code of [unitAllocation, reserveSlotSql]) {
  assert.ok(code.includes(`"expiresAt" < (now() AT TIME ZONE 'UTC')`),
    "Expiry SQL must compare UTC timestamp without session TZ coercion");
  assert.ok(code.includes(`"updatedAt" = (now() AT TIME ZONE 'UTC')`),
    "Raw SQL must also write updatedAt in UTC");
}
assert.match(route, /Idempotency-Key/);
assert.match(route, /checkRateLimit/);
assert.ok(!service.includes("customerPhone: order.contactPhone"), "Do not reveal parent phone in business request");
assert.equal(isPartyOutboxEventType("PARTY_BOOKING_CONFIRMED"), true);
const notify = partyOutboxCopy({
  type: "PARTY_BOOKING_CONFIRMED", offerTitle: "Зал", dateLabel: "1 ноября",
});
assert.equal(notify.audience, "USER");
assert.match(notify.body, /подтвердил/);
console.log("Party business confirmation safety contracts: OK");
