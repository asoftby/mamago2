import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { overlapsBookingWindow } from "./partyAvailabilityPreview.logic";
const route = readFileSync("src/app/api/public/party-availability/route.ts", "utf8");
const service = readFileSync("src/server/birthday/partyAvailabilityPreview.service.ts", "utf8");
for (const check of ["checkRateLimit", "finalConfirmationRequired: true", "private, no-store", "childrenCount", "adultsCount"]) {
  assert.ok(route.includes(check), "Missing public preview guard: " + check);
}
for (const check of ["isWithinSchedule", "minskBookingWindow", "calendarBlock.findMany", "bookingAllocation.findMany", 'status: "CONFIRMED"', 'status: "HELD"', '"AVAILABLE"', '"UNAVAILABLE"', '"UNKNOWN"']) {
  assert.ok(service.includes(check), "Missing availability rule: " + check);
}
assert.ok(!service.includes("bookingAllocation.create"), "preview must never reserve resources");
assert.ok(!service.includes("calendarBlock.findFirst"), "calendar blocks must use batched lookup");
assert.ok(!service.includes("bookingAllocation.findFirst"), "allocations must use batched lookup");
assert.match(service, /bookingUnitId: \{ in: ids \}/);
const at = (minutes: number) => new Date(2026, 0, 1, 0, minutes);
const window = { blockStart: at(60), blockEnd: at(120) };
assert.equal(overlapsBookingWindow({ blockStart: at(0), blockEnd: at(60) }, window), false);
assert.equal(overlapsBookingWindow({ blockStart: at(120), blockEnd: at(180) }, window), false);
assert.equal(overlapsBookingWindow({ blockStart: at(59), blockEnd: at(61) }, window), true);
assert.equal(overlapsBookingWindow({ blockStart: at(119), blockEnd: at(121) }, window), true);
assert.equal(overlapsBookingWindow({ blockStart: at(60), blockEnd: at(120) }, window), true);
console.log("partyAvailabilityPreview.test.ts: OK");
