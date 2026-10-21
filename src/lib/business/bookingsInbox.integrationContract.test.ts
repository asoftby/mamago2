import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}
const ui = source("../../components/business/bookings/inbox/BookingsInbox.tsx");
const detail = source("../../components/business/bookings/inbox/StandardBookingDetails.tsx");
const service = source("../../server/services/booking/businessInbox.service.ts");
const bookings = source("../../server/services/booking/bookingQuery.service.ts");
const api = source("../../app/api/business/bookings/[id]/route.ts");

assert.match(ui, /response\?\.query === query \? response\.result : null/);
assert.match(ui, /setResponse\(\{ query: tab \+ ":" \+ kind, result: json \}\)/);
assert.match(ui, /setState\("loading"\)/);
assert.match(ui, /onStandard=\{setStandardId\}/);
assert.match(ui, /<StandardBookingDetails/);
assert.match(ui, /action === "RECONFIRM"/);
assert.match(ui, /Предложить другие условия/);
assert.doesNotMatch(ui, /Подтвердить условия/);
assert.doesNotMatch(ui, /\?view=calendar&id/);

assert.match(service, /decision\.bucket === "UPCOMING" &&/);
assert.match(service, /kind === "all" \|\| row\.kind ===/);

assert.match(api, /export async function GET/);
assert.match(api, /getBusinessBookingById\(id, business\.id\)/);
assert.match(bookings, /where: \{ id: bookingId, businessId, kind: BookingKind\.STANDARD \}/);
assert.match(detail, /BookingDetailsDrawer/);
assert.match(detail, /getBusinessBookingById|\/api\/business\/bookings\//);

console.log("Unified bookings inbox regression contracts: OK");
