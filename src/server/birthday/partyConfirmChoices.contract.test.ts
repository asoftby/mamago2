import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const query = readFileSync(new URL("./partyConfirmChoices.service.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/business/party-requests/[id]/units/route.ts", import.meta.url), "utf8");
const confirm = readFileSync(new URL("./partyConfirm.service.ts", import.meta.url), "utf8");
for (const invariant of [
  "businessId, kind: BookingKind.PARTY",
  'partyStage: "AWAITING_RECONFIRM"',
  'status !== "ACCEPTED"',
  "quoteVersion: quote.version",
  "minskBookingWindow",
  "isWithinSchedule",
  "calendarBlock.findFirst",
  "bookingAllocation.findFirst",
  "manualAllowed: !requireUnit && mapped.length === 0",
]) {
  assert.ok(query.includes(invariant), "Missing preview invariant " + invariant);
}
assert.match(route, /getMyBusiness\(user.id\)/);
assert.match(route, /listPartyConfirmChoices\(business.id, id\)/);
assert.match(confirm, /bookingUnitOffer.findMany/);
assert.match(confirm, /BookingAllocation_no_active_overlap/);
console.log("Party confirmation room-choice API contracts: OK");
