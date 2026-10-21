import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  heldPartyOutboxEventTypes, isPartyOutboxEventType, partyOutboxCopy,
} from "./partyOutbox.logic";

const service = readFileSync("src/server/birthday/partyConfirmation.service.ts", "utf8");
const parent = readFileSync("src/app/api/parent/parties/[id]/requests/[requestId]/accept/route.ts", "utf8");
const business = readFileSync("src/app/api/business/party-requests/[id]/confirm/route.ts", "utf8");
const unitsRoute = readFileSync("src/app/api/business/party-requests/[id]/units/route.ts", "utf8");
const worker = readFileSync("src/server/birthday/partyOutbox.service.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");

for (const key of [
  "bookingRequest.updateMany(", "partyQuote.updateMany(", "partyOrder.updateMany(",
  "quote.version !== expectedQuoteVersion", "lastActivityAt: row.lastActivityAt",
  "responseDueAt: { gt: now }", "validUntil: { gt: now }",
  "type: \"QUOTE_ACCEPTED\"", "type: \"STATUS_CHANGED\"",
  "await tx.bookingAllocation.create(", "status: \"CONFIRMED\", expiresAt: null",
  "quoteId: selected.id", "bookingUnitId, serviceStart: start, serviceEnd: end",
  "getBusinessBookingById", // must be absent: no STANDARD booking status shortcuts
]) {
  if (key === "getBusinessBookingById") {
    assert.ok(!service.includes(key), "Cannot confirm PARTY through STANDARD booking helper");
  } else {
    assert.ok(service.includes(key), "Missing party confirmation safety check: " + key);
  }
}
assert.match(service, /partyOrderItem: \{\s*select: \{ id: true, role: true, confirmedBookingRequestId/);
assert.match(service, /partyOrderItem: \{\s*partyOrderId: partyId, role: "ANCHOR", partyOrder: \{ ownerUserId \}/);
assert.match(service, /kind: BookingKind\.PARTY/);
assert.match(service, /offers: \{ some: \{ offerId: row\.offerId! \} \}/);
assert.match(service, /await loadSlotSnapshot/);
assert.match(service, /calculateSlots\(snapshot/);
assert.match(service, /isAllocationConflict/);
assert.match(service, /"BookingAllocation_no_active_overlap"/);
assert.match(service, /dedupeKey: "party:" \+ requestId \+ ":confirmed:" \+ selected\.id/);
assert.match(service, /dedupeKey: "party:" \+ requestId \+ ":quote-accepted:" \+ selected\.id/);
assert.match(service, /where: \{ id: row\.partyOrderItem!\.id, confirmedBookingRequestId: null/);
assert.match(schema, /@@unique\(\[bookingRequestId, version\]\)/);
assert.match(schema, /partyQuoteId String\? @unique/);

for (const route of [parent, business]) {
  assert.match(route, /PARTY_CONFIRMATION_ENABLED/);
  assert.match(route, /BUSINESS_BOOKINGS_INBOX_UI/);
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /expectedQuoteVersion/);
  assert.match(route, /getCurrentUser/);
  assert.match(route, /partyRouteError\(error\)/);
}
assert.match(parent, /acceptPartyQuote/);
assert.match(business, /getMyBusiness/);
assert.match(business, /operationalStatus !== "ACTIVE"/);
assert.match(business, /confirmPartyAnchor/);
assert.match(unitsRoute, /getMyBusiness/);
assert.match(unitsRoute, /listConfirmablePartyUnits/);
assert.match(service, /export async function listConfirmablePartyUnits/);
assert.match(worker, /row\.eventType === "PARTY_QUOTE_ACCEPTED"/);
assert.ok(heldPartyOutboxEventTypes({}).includes("PARTY_QUOTE_ACCEPTED"));
for (const type of ["PARTY_QUOTE_ACCEPTED", "PARTY_BOOKING_CONFIRMED"] as const) {
  assert.ok(isPartyOutboxEventType(type));
  assert.doesNotMatch(partyOutboxCopy({
    type, offerTitle: "Праздник", dateLabel: "2026-12-10",
  }).body, /\+375/);
}
console.log("partyConfirmation.contract.test.ts: OK");
