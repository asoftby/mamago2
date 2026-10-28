import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync("src/app/api/public/party-availability/route.ts", "utf8");
const service = readFileSync("src/server/birthday/partyAvailabilityPreview.service.ts", "utf8");
for (const check of ["checkRateLimit", "finalConfirmationRequired: true", "private, no-store", "childrenCount", "adultsCount"]) {
  assert.ok(route.includes(check), "Missing public preview guard: " + check);
}
for (const check of ["isWithinSchedule", "minskBookingWindow", "calendarBlock.findFirst", "bookingAllocation.findFirst", 'status: "CONFIRMED"', 'status: "HELD"', '"AVAILABLE"', '"UNAVAILABLE"', '"UNKNOWN"']) {
  assert.ok(service.includes(check), "Missing availability rule: " + check);
}
assert.ok(!service.includes("bookingAllocation.create"), "preview must never reserve resources");
console.log("partyAvailabilityPreview.test.ts: OK");
