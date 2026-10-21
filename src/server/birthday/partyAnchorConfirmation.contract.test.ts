import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import {
  PRIMARY_ENTERTAINMENT_CATEGORIES, assertCompatibleSelection, isAutoConfirmMode, partyAnchorProblem,
  type CatalogOffer,
} from "./partySelection";
import { PartyApiError } from "./partyDraft.validation";
import { isFixedPriceReply } from "./partyFixedPrice";
import { partyItemCustomerLabel } from "./partyItemLabel";
import { partyOutboxCopy } from "./partyOutbox.logic";

const offer = (over: Partial<CatalogOffer>): CatalogOffer => ({
  id: "o", productType: "PARTY_SERVICE", category: "ANIMATOR", partyLocationType: "BOTH",
  priceFrom: 100, priceMode: "FROM", currency: "BYN", details: null, components: [],
  place: { ownerBusinessId: "b" }, ...over,
});
const animator = offer({});
const venue = offer({ category: "VENUE", partyLocationType: "ON_SITE" });
const cake = offer({ category: "CAKE" });
const status = (run: () => void) => { try { run(); } catch (e) { return (e as PartyApiError).status; } return 0; };

// R1: anchor is a role. HOME/OUTDOOR need primary entertainment; VENUE/PACKAGE need a venue.
assert.deepEqual([...PRIMARY_ENTERTAINMENT_CATEGORIES], ["ANIMATOR", "SHOW", "PROGRAM", "MASTER_CLASS"]);
assert.equal(status(() => assertCompatibleSelection("HOME", animator, [])), 0);
assert.equal(status(() => assertCompatibleSelection("OUTDOOR", offer({ category: "SHOW" }), [])), 0);
assert.equal(status(() => assertCompatibleSelection("HOME", venue, [])), 422);
assert.equal(status(() => assertCompatibleSelection("HOME", cake, [])), 422);
assert.equal(status(() => assertCompatibleSelection("VENUE", animator, [])), 422);
assert.equal(status(() => assertCompatibleSelection("PACKAGE", animator, [])), 422);
assert.equal(status(() => assertCompatibleSelection("VENUE", venue, [])), 0);
assert.match(partyAnchorProblem("HOME", offer({ category: "VENUE" })) ?? "", /площадка/);
assert.equal(status(() => assertCompatibleSelection("HOME", offer({ category: "VENUE" }), [])), 422);
assert.equal(isAutoConfirmMode("HOME"), true);
assert.equal(isAutoConfirmMode("OUTDOOR"), true);
assert.equal(isAutoConfirmMode("VENUE"), false);
assert.equal(isAutoConfirmMode("PACKAGE"), false);

// R2: fixed price (Decimal compare, duration not shorter) confirms; anything else is a quote.
const D = (v: string) => new Prisma.Decimal(v);
const base = { type: "AS_REQUESTED", pricingMode: "BOOK", snapshot: D("350"), priceByn: 350, orderDurationMinutes: null };
assert.equal(isFixedPriceReply(base), true);
assert.equal(isFixedPriceReply({ ...base, snapshot: D("0.3"), priceByn: 0.3 }), true);
assert.equal(isFixedPriceReply({ ...base, snapshot: D("350.00") }), true);
assert.equal(isFixedPriceReply({ ...base, priceByn: 351 }), false);
assert.equal(isFixedPriceReply({ ...base, snapshot: null }), false);
assert.equal(isFixedPriceReply({ ...base, type: "MODIFIED" }), false);
assert.equal(isFixedPriceReply({ ...base, pricingMode: "QUOTE" }), false);
assert.equal(isFixedPriceReply({ ...base, orderDurationMinutes: 120, replyDurationMinutes: 90 }), false);
assert.equal(isFixedPriceReply({ ...base, orderDurationMinutes: 120 }), false);
assert.equal(isFixedPriceReply({ ...base, orderDurationMinutes: 120, replyDurationMinutes: 120 }), true);

const service = readFileSync("src/server/birthday/partyBusiness.service.ts", "utf8");
for (const needle of [
  "isAutoConfirmMode(order.venueMode)", 'autoConfirm ? "CONFIRMED" : "QUOTED"',
  "PartyOrderStatus.ANCHOR_CONFIRMED", 'autoConfirm ? "ACCEPTED" : "ACTIVE"', "decidedByUserId: null",
  "confirmedBookingRequestId: null", "confirmedBookingRequestId: requestId",
  'rule: "FIXED_PRICE"', "auto: true", '"PARTY_BOOKING_CONFIRMED"', '"party:" + requestId + ":confirmed"',
  "lastActivityAt: existing.lastActivityAt",
]) assert.ok(service.includes(needle), "Missing auto-confirm invariant: " + needle);
assert.ok(!service.includes("addonRequests") && !service.includes('"PARTY_REQUEST_SENT"'), "No fan-out on auto-confirm (PR 3)");
// Retry with the same Idempotency-Key short-circuits before any write.
assert.ok(service.indexOf("bookingRequestId_idempotencyKey") < service.indexOf("prisma.$transaction"));
assert.equal(partyOutboxCopy({ type: "PARTY_BOOKING_CONFIRMED", offerTitle: "Аниматор", dateLabel: "x" }).actionUrl, "/me/birthdays");

// R3: prepaid.
const prepaid = readFileSync("src/server/birthday/partyPrepaid.service.ts", "utf8");
const route = readFileSync("src/app/api/business/party-requests/[id]/prepaid/route.ts", "utf8");
for (const needle of [
  "businessId, kind: BookingKind.PARTY", 'req.partyStage !== "CONFIRMED"', "BookingStatus.CONFIRMED",
  "lastActivityAt: req.lastActivityAt", "prepaidAt: null", "prepaidMarkedByUserId: actorUserId",
  '"PREPAYMENT_MARKED"', "alreadyMarked: true",
]) assert.ok(prepaid.includes(needle), "Missing prepaid invariant: " + needle);
for (const needle of ["getMyBusiness", "Idempotency-Key", 'operationalStatus !== "ACTIVE"', "markPartyPrepaid"]) {
  assert.ok(route.includes(needle), "Missing prepaid route invariant: " + needle);
}
assert.ok(!prepaid.includes("contactPhone"), "Parent contacts must remain private");

// Customer label for every item status.
const L = partyItemCustomerLabel;
assert.equal(L({ status: "PLANNED" }), "Ждём ответа");
assert.equal(L({ status: "REQUESTED" }), "Ждём ответа");
assert.equal(L({ status: "NEEDS_DECISION" }), "Свободен, согласуйте цену");
assert.equal(L({ status: "CONFIRMED" }), "Подтверждено исполнителем");
assert.equal(L({ status: "CONFIRMED", prepaidAt: null }), "Подтверждено исполнителем");
assert.equal(L({ status: "CONFIRMED", prepaidAt: new Date() }), "Забронировано");
for (const s of ["DECLINED", "EXPIRED", "CANCELLED"] as const) assert.equal(L({ status: s }), "Нужна замена");
assert.equal(L({ status: "NEEDS_DECISION", prepaidAt: new Date() }), "Свободен, согласуйте цену");

// Additive schema.
const schema = readFileSync("prisma/schema.prisma", "utf8");
for (const needle of [
  "enum PartyOrderEntry", "entry PartyOrderEntry @default(FULL)", "enum PartyPricingMode",
  "pricingMode PartyPricingMode @default(BOOK)", "prepaidAt DateTime?", "PREPAYMENT_MARKED",
]) assert.ok(schema.includes(needle), "Missing schema: " + needle);
console.log("partyAnchorConfirmation.contract.test.ts: OK");
