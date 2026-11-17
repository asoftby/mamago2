import assert from "node:assert/strict";
import { test } from "node:test";
import { BookingKind, BookingStatus, DirectThreadStatus, PartyRequestStage } from "@prisma/client";
import {
  BUSINESS_ENQUIRY_REPLY_DAYS,
  canBusinessContactForBooking,
  canBusinessWriteDirect,
  type BusinessDirectWriteContext,
} from "./directBusinessWritePolicy";

const now = new Date("2026-11-17T15:00:00.000Z");
const liveBooking = {
  status: BookingStatus.NEW,
  kind: BookingKind.STANDARD,
  partyStage: null,
  userId: "customer-1",
  businessId: "business-1",
  endsAt: null,
};
const bookingThread: BusinessDirectWriteContext = {
  threadStatus: DirectThreadStatus.OPEN,
  threadBusinessId: "business-1",
  threadCustomerUserId: "customer-1",
  bookingRequestId: "booking-1",
  booking: liveBooking,
  latestCustomerMessageAt: null,
  now,
};

test("a business can reply to NEW and CONFIRMED booking, even before a customer's chat message", () => {
  assert.equal(canBusinessWriteDirect(bookingThread), true);
  assert.equal(canBusinessWriteDirect({
    ...bookingThread, booking: { ...liveBooking, status: BookingStatus.CONFIRMED },
  }), true);
});

test("all terminal booking statuses deny business contact", () => {
  for (const status of [
    BookingStatus.COMPLETED, BookingStatus.CANCELLED,
    BookingStatus.REJECTED, BookingStatus.EXPIRED,
  ]) {
    assert.equal(canBusinessWriteDirect({
      ...bookingThread, booking: { ...liveBooking, status },
    }), false, status);
    assert.equal(canBusinessContactForBooking({ ...liveBooking, status }, now), false, status);
  }
});

test("elapsed explicit end blocks business replies even on stale CONFIRMED status", () => {
  assert.equal(canBusinessWriteDirect({
    ...bookingThread,
    booking: { ...liveBooking, status: BookingStatus.CONFIRMED, endsAt: new Date(now.getTime()) },
  }), false);
  assert.equal(canBusinessWriteDirect({
    ...bookingThread,
    booking: { ...liveBooking, endsAt: new Date(now.getTime() + 60_000) },
  }), true);
});

test("deleted, foreign or forged booking linkage always denies", () => {
  assert.equal(canBusinessWriteDirect({ ...bookingThread, booking: null }), false);
  assert.equal(canBusinessWriteDirect({
    ...bookingThread, booking: { ...liveBooking, userId: "someone-else" },
  }), false);
  assert.equal(canBusinessWriteDirect({
    ...bookingThread, booking: { ...liveBooking, businessId: "other-business" },
  }), false);
});

test("business cannot write to closed, archived or blocked Direct thread", () => {
  for (const threadStatus of [
    DirectThreadStatus.CLOSED, DirectThreadStatus.ARCHIVED, DirectThreadStatus.BLOCKED,
  ]) {
    assert.equal(canBusinessWriteDirect({ ...bookingThread, threadStatus }), false, threadStatus);
  }
});

test("unlinked enquiries require recent explicit inbound CUSTOMER message", () => {
  const enquiry = {
    ...bookingThread, bookingRequestId: null, booking: null,
    latestCustomerMessageAt: new Date(now.getTime() - 60_000),
  };
  assert.equal(canBusinessWriteDirect(enquiry), true);
  assert.equal(canBusinessWriteDirect({ ...enquiry, latestCustomerMessageAt: null }), false);
  const window = BUSINESS_ENQUIRY_REPLY_DAYS * 24 * 60 * 60 * 1000;
  assert.equal(canBusinessWriteDirect({
    ...enquiry, latestCustomerMessageAt: new Date(now.getTime() - window + 1),
  }), true);
  assert.equal(canBusinessWriteDirect({
    ...enquiry, latestCustomerMessageAt: new Date(now.getTime() - window),
  }), false);
  assert.equal(canBusinessWriteDirect({
    ...enquiry, latestCustomerMessageAt: new Date(now.getTime() + 60_000),
  }), false);
  assert.equal(canBusinessWriteDirect({
    ...enquiry, latestCustomerMessageAt: new Date(now.getTime() - 3_600_000),
  }), true, "a new inbound message re-opens the response window");
});

test("party booking with terminal partyStage is not writable despite NEW booking status", () => {
  for (const partyStage of [
    PartyRequestStage.DECLINED, PartyRequestStage.EXPIRED,
    PartyRequestStage.NOT_ACCEPTED, PartyRequestStage.CANCELLED,
  ]) {
    assert.equal(canBusinessWriteDirect({
      ...bookingThread,
      booking: { ...liveBooking, kind: BookingKind.PARTY, partyStage },
    }), false, partyStage);
  }
  assert.equal(canBusinessWriteDirect({
    ...bookingThread,
    booking: { ...liveBooking, kind: BookingKind.PARTY, partyStage: null },
  }), false);
  for (const partyStage of [PartyRequestStage.SENT, PartyRequestStage.QUOTED, PartyRequestStage.CONFIRMED]) {
    assert.equal(canBusinessWriteDirect({
      ...bookingThread,
      booking: { ...liveBooking, kind: BookingKind.PARTY, partyStage },
    }), true, partyStage);
  }
});
