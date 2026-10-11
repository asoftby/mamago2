import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const sql = readFileSync("prisma/migrations/20261011223000_party_order_and_booking_units/migration.sql", "utf8");

for (const model of [
  "PartyOrder", "PartyOrderItem", "PartyQuote", "PartyOutbox",
  "BookingUnit", "BookingUnitOffer", "AvailabilityRule",
  "AvailabilityException", "CalendarBlock", "BookingAllocation",
]) {
  assert.match(schema, new RegExp("model " + model + " \\{"));
  assert.match(sql, new RegExp('CREATE TABLE "' + model + '"'));
}
assert.match(schema, /kind BookingKind @default\(STANDARD\)/);
assert.match(schema, /AWAITING_RECONFIRM/);
assert.match(schema, /customerName\s+String\?/);
assert.match(schema, /customerPhone\s+String\?/);
assert.match(sql, /BookingRequest_standard_contacts_required/);
assert.match(sql, /"kind" <> 'STANDARD'/);
assert.match(sql, /BookingAllocation_no_active_overlap/);
assert.match(sql, /EXCLUDE USING gist/);
assert.match(sql, /tsrange\("blockStart", "blockEnd", '\[\)'\)/);
assert.match(sql, /CREATE EXTENSION IF NOT EXISTS btree_gist/);
assert.match(sql, /AvailabilityRule_valid_interval/);
assert.match(sql, /PartyQuote_one_active_per_request/);
assert.match(sql, /BookingRequest_one_confirmed_per_party_item/);
assert.match(sql, /CalendarBlock_valid_interval/);
assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
console.log("partySchema.contract.test.ts: OK");
