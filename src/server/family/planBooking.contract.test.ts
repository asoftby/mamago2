import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const sql = read("prisma/migrations/20261007120000_booking_request_plan_item/migration.sql");
const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
assert.match(code, /ADD COLUMN "planItemId" TEXT;/, "nullable column");
assert.doesNotMatch(code, /^\s*(DROP |DELETE FROM|UPDATE "|TRUNCATE)/m, "additive only");
assert.match(code, /ON DELETE SET NULL/, "deleting a plan item keeps the booking");
assert.match(read("prisma/schema.prisma"), /planItemId String\?/);
assert.match(read("src/lib/prisma.ts"), /PRISMA_CACHE_VERSION = "v\d+"/);

// The state shown to other adults selects ONLY safe fields.
const svc = read("src/server/family/planBooking.service.ts");
const stateFn = svc.slice(svc.indexOf("export async function getPlanBookingStates"));
const select = stateFn.match(/select: \{[\s\S]*?\n    \},\n  \}\);/)?.[0] ?? "";
assert.ok(select.length > 0, "state query has an explicit select");
for (const forbidden of ["customerName", "customerPhone", "customerEmail", "customerComment", "childName", "childAge", "business", "include:"]) {
  assert.ok(!select.includes(forbidden), `state must not read ${forbidden}`);
}
assert.match(stateFn, /planItem: \{ is: await planScopeFor\(viewerId\)/, "state is scoped to the viewer's plan access");

// An explicit plan item must be visible to the booker; unauthenticated users cannot link.
assert.match(svc, /activePlanScopeFor\(input\.userId\)/);
const booking = read("src/server/services/booking/booking.service.ts");
assert.match(booking, /resolveBookingPlanItem\(/);
assert.match(booking, /BookingValidationError\("planItemId"/);
assert.equal((booking.match(/planItemId: planLink\.planItemId \?\? undefined/g) ?? []).length, 3, "event, offer, place bookings are linked");
assert.match(booking, /\.\.\.\(context\.planItemId \? \{ planItemId: context\.planItemId \} : \{\}\)/, "BOOKING_CREATED carries planItemId");

// Contacts stay with the booker: /me/bookings reads only the user's own bookings.
const parent = read("src/server/services/booking/parentBookings.service.ts");
assert.match(parent, /where: \{[\s\S]{0,80}userId/, "parent bookings are filtered by userId");
assert.doesNotMatch(parent, /planScopeFor|planItemId/, "family scope must not widen parent bookings");

// The plan card gets the safe state only.
const page = read("src/app/(public)/me/plan/page.tsx");
assert.match(page, /getPlanBookingStates\(/);
console.log("planBooking.contract.test: ok");
