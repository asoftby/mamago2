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
assert.equal((booking.match(/planItemId: planLink\.planItemId \?\? undefined/g) ?? []).length, 2, "offer and place bookings retain their explicit/auto link");
assert.match(booking, /await ensureEventBookingPlanItem\(tx,/, "event linkage uses the locked booking transaction");
assert.match(booking, /planItemId: linkedPlanItemId \?\? undefined/, "event persists its transactionally resolved occurrence");
assert.ok(booking.indexOf("await ensureEventBookingPlanItem(tx,") < booking.indexOf("planItemId: linkedPlanItemId"),
  "resolve event occurrence before persisting the linked request");
assert.match(booking, /\.\.\.\(context\.planItemId \? \{ planItemId: context\.planItemId \} : \{\}\)/, "BOOKING_CREATED carries planItemId");

// Contacts stay with the booker: /me/bookings reads only the user's own bookings.
const parent = read("src/server/services/booking/parentBookings.service.ts");
assert.match(parent, /where: \{[\s\S]{0,80}userId/, "parent bookings are filtered by userId");
assert.doesNotMatch(parent, /planScopeFor|planItemId/, "family scope must not widen parent bookings");

// The plan card gets the safe state only.
const calendar = read("src/server/services/familyCalendar.service.ts");
assert.match(calendar, /getPlanBookingStates\(input\.owner\.userId, items\.map/);
assert.match(read("src/app/(public)/me/plan/page.tsx"), /loadFamilyCalendarRange\(/);

const eventPage = read("src/components/event-page/EventPageView.tsx");
const decisionPanel = read("src/components/event-page/EventDecisionPanel.tsx");
for (const component of ["EventDecisionPanel", "EventSimpleBookingModal"]) {
  const invocation = eventPage.match(new RegExp("<" + component + "[\\s\\S]*?/>"))?.[0] ?? "";
  assert.match(invocation, /isAuthenticated=\{isAuthenticated\}/, component + " preserves signed-in success wording");
  assert.match(invocation, /onBooked=\{handleBookingSuccess\}/, component + " refreshes saved-plan status");
  assert.match(invocation, /initialSessionId=\{selectedId\}/, component + " preserves the selected session");
}
const heroModal = decisionPanel.match(/<EventSimpleBookingModal[\s\S]*?\/>/)?.[0] ?? "";
assert.match(heroModal, /isAuthenticated=\{isAuthenticated\}/);
assert.match(heroModal, /onBooked=\{onBooked\}/);
assert.match(heroModal, /initialSessionId=\{initialSessionId\}/);

console.log("planBooking transaction linkage and hero booking context: ok");
