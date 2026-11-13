/** Run: npx tsx src/lib/event/ownEventBooking.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bookingForSession,
  resolveBookingMoment,
  bookingStateText,
  isActiveBookingStatus,
  pickDisplayedBooking,
  type OwnEventBooking,
} from "./ownEventBooking";

const now = new Date("2026-11-13T09:00:00.000Z");
const b = (id: string, at: string, status: "NEW" | "CONFIRMED" = "NEW", sessionId: string | null = id): OwnEventBooking => ({
  id, at, status, sessionId, hasTime: true,
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
  bookingForSession([b("a", "2026-11-16T07:00:00.000Z", "NEW", "s"), b("c", "2026-11-16T07:00:00.000Z", "CONFIRMED", "s")], "s")?.id,
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
assert.deepEqual(resolveBookingMoment({ startsAt: s, requestedDate: null, requestedTime: null }), { at: s.toISOString(), hasTime: true });
assert.deepEqual(
  resolveBookingMoment({ startsAt: null, requestedDate: new Date("2026-11-16T00:00:00.000Z"), requestedTime: "10:00" }),
  { at: "2026-11-16T07:00:00.000Z", hasTime: true },
);
assert.deepEqual(resolveBookingMoment({ startsAt: null, requestedDate: null, requestedTime: null }), { at: null, hasTime: false });

// date-only (USE_PUBLICATION_DATES): date shown, never a time; end of day is only a threshold
const dateOnly = resolveBookingMoment({ startsAt: null, requestedDate: new Date("2026-12-01T00:00:00.000Z"), requestedTime: null });
assert.equal(dateOnly.hasTime, false);
const dateOnlyBooking: OwnEventBooking = { id: "d", status: "CONFIRMED", sessionId: null, ...dateOnly };
assert.equal(bookingStateText(dateOnlyBooking), "Запись подтверждена · 1 декабря");
assert.ok(!/\d{2}:\d{2}/.test(bookingStateText(dateOnlyBooking)));
assert.equal(pickDisplayedBooking([dateOnlyBooking], new Date("2026-12-01T10:00:00.000Z"))?.id, "d", "still future on the day itself");
assert.equal(pickDisplayedBooking([dateOnlyBooking], new Date("2026-12-02T00:00:00.000Z")), null);

// dateless active request (REQUEST_ONLY / pre-booking) stays visible
const dateless: OwnEventBooking = { id: "x", status: "NEW", sessionId: null, at: null, hasTime: false };
assert.equal(pickDisplayedBooking([dateless], now)?.id, "x");
assert.equal(pickDisplayedBooking([dateless, far], now)?.id, "f", "dated booking wins");
assert.equal(bookingStateText(dateless), "Заявка отправлена — ждём подтверждения");
assert.equal(bookingStateText({ ...dateless, status: "CONFIRMED" }), "Заявка подтверждена");

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
