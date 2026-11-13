/** Run: npx tsx src/lib/event/ownEventBooking.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bookingForSession,
  bookingMomentIso,
  bookingStateText,
  isActiveBookingStatus,
  pickDisplayedBooking,
  type OwnEventBooking,
} from "./ownEventBooking";

const now = new Date("2026-11-13T09:00:00.000Z");
const b = (id: string, at: string, status: "NEW" | "CONFIRMED" = "NEW", sessionId: string | null = id): OwnEventBooking => ({
  id, at, status, sessionId,
});

// nearest future wins, past ignored, input order irrelevant
const past = b("p", "2026-11-01T07:00:00.000Z");
const far = b("f", "2026-12-01T07:00:00.000Z");
const near = b("n", "2026-11-16T07:00:00.000Z");
assert.equal(pickDisplayedBooking([far, past, near], now)?.id, "n");
assert.equal(pickDisplayedBooking([past], now), null);
assert.equal(pickDisplayedBooking([], now), null);

// per-session lookup; other slots stay bookable
assert.equal(bookingForSession([near, far], "n")?.id, "n");
assert.equal(bookingForSession([near, far], "other"), null);
assert.equal(
  bookingForSession([b("a", near.at, "NEW", "s"), b("c", near.at, "CONFIRMED", "s")], "s")?.id,
  "c",
);

// texts
assert.equal(bookingStateText(near), "Запись оставлена · 16 ноября, 10:00 — ждём подтверждения");
assert.equal(bookingStateText({ ...near, status: "CONFIRMED" }), "Запись подтверждена · 16 ноября, 10:00");

// statuses: extensible, EXPIRED not handled yet
assert.ok(isActiveBookingStatus("NEW") && isActiveBookingStatus("CONFIRMED"));
assert.ok(!isActiveBookingStatus("EXPIRED") && !isActiveBookingStatus("CANCELLED"));

// moment resolution
const s = new Date("2026-11-16T07:00:00.000Z");
assert.equal(bookingMomentIso({ startsAt: s, requestedDate: null, requestedTime: null }), s.toISOString());
assert.equal(
  bookingMomentIso({ startsAt: null, requestedDate: new Date("2026-11-16T00:00:00.000Z"), requestedTime: "10:00" }),
  "2026-11-16T07:00:00.000Z",
);
assert.equal(bookingMomentIso({ startsAt: null, requestedDate: null, requestedTime: null }), null);

// privacy wiring: query is scoped to the current user, guests get an empty list, never cached
const route = readFileSync("src/app/api/save/status/route.ts", "utf8");
const guest = route.slice(route.indexOf("if (!user) {"), route.indexOf("const { searchParams }"));
assert.match(guest, /ownBookings:\s*\[\]/);
const q = route.slice(route.indexOf("bookingRequest.findMany"));
assert.match(q.slice(0, 400), /userId:\s*user\.id/);
assert.match(route, /private, no-store/);
const page = readFileSync("src/app/(public)/[city]/events/[slugOrId]/page.tsx", "utf8");
assert.doesNotMatch(page, /bookingRequest|ownBookings/, "page SSR must not carry private booking data");

console.log("ownEventBooking test: OK");
