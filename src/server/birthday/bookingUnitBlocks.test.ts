import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/business/booking-units/[id]/blocks/route.ts", "utf8");
for (const guard of [
  "getCurrentUser()", "getMyBusiness(user.id)", "businessId: owner",
  "FOR UPDATE", "tx.bookingAllocation.findFirst", "tx.calendarBlock.findFirst",
  'status: "CONFIRMED"', 'status: "HELD"',
  'source: "MANUAL"', 'bookingUnit: { businessId: owner }',
  "deleteMany", "blockStart: { lt: end }", "blockEnd: { gt: start }",
]) assert.ok(route.includes(guard), "Missing required safety contract: " + guard);
assert.ok(route.indexOf("FOR UPDATE") < route.indexOf("tx.bookingAllocation.findFirst"),
  "lock resource before checking overlapping reservations");
assert.ok(route.indexOf("tx.bookingAllocation.findFirst") < route.indexOf("tx.calendarBlock.create"),
  "check reservations before writing block");
assert.ok(!route.includes("bookingAllocation.delete"), "never delete customer reservations");
console.log("bookingUnitBlocks.test.ts: contract OK");
