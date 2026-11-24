import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const notify = readFileSync("src/server/services/notification.service.ts", "utf8");
const open = readFileSync("src/app/telegram/business/open/page.tsx", "utf8");
const client = readFileSync("src/app/business/(protected)/bookings/BookingsPageClient.tsx", "utf8");
const status = readFileSync("src/app/api/business/bookings/[id]/status/route.ts", "utf8");
const legacy = readFileSync("src/app/api/business/bookings/[id]/route.ts", "utf8");
const service = readFileSync("src/server/services/booking/bookingQuery.service.ts", "utf8");

assert.ok(notify.includes('/business/bookings?id='), "Business Telegram notifications deep-link to selected order");
assert.ok(open.includes('path.pathname === "/business/bookings"'), "Business launcher allowlists the inbox path");
assert.ok(client.includes('searchParams.get("id") ?? searchParams.get("request")'),
  "Old and new Telegram links open the same selected booking");
assert.ok(client.includes("/decision"), "Approval drawer requests current seat capacity");
assert.ok(client.includes("Причина отказа — обязательна"), "Rejection reason required by UI");
assert.ok(status.includes("businessBookingDecisionSchema"));
assert.ok(legacy.includes("businessBookingDecisionSchema"));
assert.ok(service.includes("getBusinessBookingDecisionAvailability(tx"), "Server confirmation must recheck capacity under transaction lock");
console.log("Business Mini App booking decisions contract: PASS");
