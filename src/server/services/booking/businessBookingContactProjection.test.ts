import assert from "node:assert/strict";
import { test } from "node:test";
import { BookingStatus } from "@prisma/client";
import type { BusinessBookingItem } from "./bookingQuery.service";
import {
  businessBookingListProjection,
  businessBookingDetailProjection,
  businessBookingDetailRevealsContact,
} from "./businessBookingContactProjection";

const booking = {
  id: "booking-1",
  status: BookingStatus.NEW,
  createdAt: new Date().toISOString(),
  customerName: "Мария Иванова",
  customerPhone: "+375291234567",
  customerEmail: "test@example.test",
  customerComment: "Позвонить на +375291234567",
  childName: "Саша",
  childAge: 7,
  participantChildren: [{ name: "Саша", age: 7 }],
  participantsOutsideAge: [{ name: "Саша", age: 7 }],
  display: { title: "Секция", meta: "Саша · 7 лет" },
  bookingPriceSnapshot: { extra: "Саша", phone: "+375291234567" },
} as unknown as BusinessBookingItem;

test("bulk business bookings never expose PII, even on NEW status", () => {
  const listed = businessBookingListProjection(booking);
  const serialized = JSON.stringify(listed);
  for (const personal of ["Мария", "Иванова", "+375291234567", "test@example.test", "Саша"]) {
    assert.equal(serialized.includes(personal), false, personal);
  }
  assert.equal(listed.participantChildren[0]?.age, 7);
  assert.equal(listed.customerPhone, "");
  assert.equal(listed.bookingPriceSnapshot, null);
  // The source object is not mutated: exact-order detail can still be queried.
  assert.equal(booking.customerPhone, "+375291234567");
});

test("single active order only exposes fulfillment contact, never email", () => {
  const detail = businessBookingDetailProjection(booking);
  assert.equal(detail.customerPhone, "+375291234567");
  assert.equal(detail.customerName, "Мария Иванова");
  assert.equal(detail.customerEmail, null);
  assert.equal(businessBookingDetailRevealsContact(detail), true);
});

test("historical bookings are permanently redacted in business detail", () => {
  for (const status of [
    BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.EXPIRED,
  ]) {
    const historical = businessBookingDetailProjection({ ...booking, status });
    assert.equal(historical.customerPhone, "", status);
    assert.equal(historical.customerName, "Клиент", status);
    assert.equal(historical.customerEmail, null, status);
    assert.equal(historical.childName, null, status);
    assert.equal(historical.participantChildren[0]?.name, null, status);
    assert.equal(businessBookingDetailRevealsContact(historical), false, status);
  }
});

test("stale CONFIRMED or NEW booking cannot expose contacts after known service end", () => {
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  for (const status of [BookingStatus.NEW, BookingStatus.CONFIRMED]) {
    const stale = { ...booking, status, endsAt: expiredAt };
    const projected = businessBookingDetailProjection(stale);
    assert.equal(projected.customerPhone, "", status);
    assert.equal(projected.customerName, "Клиент", status);
    assert.equal(projected.childName, null, status);
    assert.equal(businessBookingDetailRevealsContact(stale), false, status);
  }
  const future = { ...booking, status: BookingStatus.CONFIRMED,
    endsAt: new Date(Date.now() + 86_400_000).toISOString() };
  assert.equal(businessBookingDetailProjection(future).customerPhone, booking.customerPhone);
  assert.equal(businessBookingDetailRevealsContact(future), true);
  const invalid = { ...booking, endsAt: "not-a-date" };
  assert.equal(businessBookingDetailProjection(invalid).customerPhone, "",
    "Invalid known service end fails closed");
});

test("undated active booking contact visibility expires after 30 days", () => {
  const old = { ...booking, endsAt: null, createdAt: new Date(Date.now() - 31 * 86_400_000).toISOString() };
  const recent = { ...booking, endsAt: null, createdAt: new Date(Date.now() - 29 * 86_400_000).toISOString() };
  assert.equal(businessBookingDetailProjection(old).customerPhone, "");
  assert.equal(businessBookingDetailRevealsContact(old), false);
  assert.equal(businessBookingDetailProjection(recent).customerPhone, booking.customerPhone);
});
