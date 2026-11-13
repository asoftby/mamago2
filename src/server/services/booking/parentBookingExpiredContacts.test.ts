import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BookingStatus } from "@prisma/client";
import { mapParentBookingRow } from "./parentBookings.service";

type Raw = Parameters<typeof mapParentBookingRow>[0];
const row = (status: BookingStatus, overrides: Partial<Raw> = {}): Raw => ({
  id: "b1", status, createdAt: new Date("2026-11-01T10:00:00Z"), completedAt: null, rejectedAt: null,
  offerId: null, activityId: "a1", placeId: null, offer: null,
  activity: {
    id: "a1", title: "Event", slug: "event", coverImageUrl: null,
    bookingPhone: "+375 29 111-22-33",
    organizer: { name: "Org", phone: "+375 29 999-99-99", website: "https://org.example", instagram: null },
    place: null,
  },
  place: null, campShiftId: null, campShiftTitle: null, campShiftDateFrom: null, campShiftDateTo: null,
  bookingPriceSnapshot: null, bookingTotalByn: null, childName: null, childAge: null,
  requestedDate: null, requestedTime: null, session: null,
  business: { name: "Biz", phone: "+375 29 000-00-00-PRIVATE" }, feedback: null,
  ...overrides,
} as Raw);

// EXPIRED: public publication contacts only, never the private business phone.
const expired = mapParentBookingRow(row(BookingStatus.EXPIRED));
assert.equal(expired.organizerPhone, "+375 29 111-22-33");
assert.equal(expired.organizerMessageUrl, "https://org.example");
const onlyBusiness = mapParentBookingRow(row(BookingStatus.EXPIRED, {
  activity: { id: "a1", title: "Event", slug: "event", coverImageUrl: null, bookingPhone: null, organizer: null, place: null },
}));
assert.equal(onlyBusiness.organizerPhone, null, "private business phone must not be exposed");

// Active NEW (not a camp): no contacts before the deadline passes.
const pending = mapParentBookingRow(row(BookingStatus.NEW));
assert.equal(pending.organizerPhone, null);
assert.equal(pending.organizerWebsite, null);
assert.equal(pending.organizerTelegramUrl, null);
assert.equal(pending.organizerMessageUrl, null);

// Card shows the contact block only for EXPIRED.
const card = readFileSync(new URL("../../../app/(public)/me/bookings/components/BookingRecordCard.tsx", import.meta.url), "utf8");
assert.match(card, /\{isExpired \? \(/);
assert.match(card, /Организатор не ответил/);
console.log("parentBookingExpiredContacts: ok");
