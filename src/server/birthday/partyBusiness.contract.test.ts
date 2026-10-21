import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPartyAttentionStage, partyBusinessReplySchema } from "./partyBusiness.validation";
import { redactPartyContacts } from "./partyPrivacy";

const base = { expectedStage: "SENT", expectedQuoteVersion: 0 };
const good = {
  ...base, type: "AS_REQUESTED", priceByn: 350,
  includes: "Аренда зала на 2 часа", prepaymentTerms: "Предоплата 50 BYN",
};
assert.equal(partyBusinessReplySchema.safeParse(good).success, true);
assert.equal(partyBusinessReplySchema.safeParse({ ...good, priceByn: 0 }).success, false);
assert.equal(partyBusinessReplySchema.safeParse({ ...good, priceByn: -1 }).success, false);
assert.equal(partyBusinessReplySchema.safeParse({ ...good, priceByn: 350, customerPhone: "+375291234567" }).success, false);
assert.equal(partyBusinessReplySchema.safeParse({ ...good, expectedStage: "QUOTED" }).success, false);
assert.equal(partyBusinessReplySchema.safeParse({ ...good, expectedQuoteVersion: -1 }).success, false);
assert.equal(partyBusinessReplySchema.safeParse({ ...good, type: "MODIFIED" }).success, false);
assert.equal(partyBusinessReplySchema.safeParse({ ...good, type: "MODIFIED", changeReason: "Изменена программа" }).success, true);
assert.equal(partyBusinessReplySchema.safeParse({ ...base, type: "DECLINED", declineReason: "DATE_BUSY" }).success, true);
assert.equal(partyBusinessReplySchema.safeParse({ ...base, type: "DECLINED", declineReason: "OTHER" }).success, false);
assert.equal(partyBusinessReplySchema.safeParse({
  ...base, type: "DECLINED", declineReason: "OTHER", declineComment: "Недоступно",
}).success, true);
assert.equal(redactPartyContacts("Звоните +375 29 123-45-67, email test@example.com, tg @my_family"), "Звоните [контакт скрыт], email [контакт скрыт], tg [контакт скрыт]");
assert.equal(redactPartyContacts("Праздник 20 октября, 2 часа"), "Праздник 20 октября, 2 часа");
assert.equal(isPartyAttentionStage("SENT"), true);
assert.equal(isPartyAttentionStage("AWAITING_RECONFIRM"), true);
for (const stage of ["QUOTED", "CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED", null]) {
  assert.equal(isPartyAttentionStage(stage), false);
}

const service = readFileSync("src/server/birthday/partyBusiness.service.ts", "utf8");
const route = readFileSync("src/app/api/business/party-requests/[id]/respond/route.ts", "utf8");
for (const required of [
  "kind: BookingKind.PARTY", "lastActivityAt: existing.lastActivityAt",
  "partyStage: input.expectedStage", "tx.partyQuote.create",
  "tx.bookingActivity.create", "tx.partyOutbox.create",
  "responseDueAt: { gt: now }", "firstResponseAt: now",
  "status: declined ? PartyItemStatus.DECLINED : PartyItemStatus.NEEDS_DECISION",
]) assert.ok(service.includes(required), "Missing transactional invariant: " + required);
assert.ok(service.includes('status: { in: ["ACTIVE", "ACCEPTED"] }'), "A revised offer must supersede previously accepted terms");
assert.ok(route.includes("getMyBusiness"), "Business membership must be verified");
assert.ok(route.includes("Idempotency-Key"), "Idempotency header is required");
assert.ok(!service.includes("customerPhone: true"), "Parent contacts must remain private");
assert.ok(!service.includes("contactPhone: true"), "Party order contacts must remain private");
assert.ok(!service.includes("status: BookingStatus.CONFIRMED"), "Reply must not confirm booking");
console.log("partyBusiness.contract.test.ts: OK");
