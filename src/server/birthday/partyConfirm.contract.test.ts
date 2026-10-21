import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partyOutboxCopy, isPartyOutboxEventType } from "./partyOutbox.logic";

const service = readFileSync(new URL("./partyConfirm.service.ts", import.meta.url), "utf8");
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
