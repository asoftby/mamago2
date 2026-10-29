import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { BookingStatus, PublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { updateBookingStatus } from "./bookingQuery.service";
import { BookingHoldExpiredError } from "./bookingHold";
import { closePastStandardBooking } from "./bookingOutcome.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Booking lifecycle tests require disposable localhost PostgreSQL");
}
const suffix = randomUUID().slice(0, 10);
const ownerId = "booking-lifecycle-" + suffix;
let businessId = "";
after(async () => {
  if (businessId) {
    await prisma.bookingAllocation.deleteMany({ where: { bookingRequest: { businessId } } });
    await prisma.bookingRequest.deleteMany({ where: { businessId } });
    await prisma.bookingUnit.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
  }
  await prisma.user.deleteMany({ where: { id: ownerId } });
  await prisma.$disconnect();
});
async function fixture() {
  if (businessId) return;
  await prisma.user.create({ data: { id: ownerId, email: ownerId + "@example.test" } });
  businessId = (await prisma.business.create({ data: {
    name: "Booking lifecycle test " + suffix, ownerUserId: ownerId,
  } })).id;
}
const contact = { customerName: "Test", customerPhone: "+375291112233" };

test("business confirmation rejects an expired group-style NEW hold without allocations", async () => {
  await fixture();
  const booking = await prisma.bookingRequest.create({ data: {
    businessId, publicationType: PublicationType.OFFER, ...contact,
    startsAt: new Date(Date.now() + 86_400_000),
    endsAt: new Date(Date.now() + 90_000_000),
    holdUntil: new Date(Date.now() - 60_000),
    status: BookingStatus.NEW,
  } });
  await assert.rejects(
    updateBookingStatus(booking.id, businessId, BookingStatus.CONFIRMED),
    (error: unknown) => error instanceof BookingHoldExpiredError,
  );
  const current = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: booking.id } });
  assert.equal(current.status, BookingStatus.NEW);
  assert.equal(await prisma.bookingAllocation.count({ where: { bookingRequestId: booking.id } }), 0);
});

test("past NOT_HELD outcome releases all exclusive resource allocations atomically", async () => {
  await fixture();
  const booking = await prisma.bookingRequest.create({ data: {
    businessId, publicationType: PublicationType.OFFER, ...contact,
    endsAt: new Date("2025-01-01T12:00:00.000Z"),
    status: BookingStatus.CONFIRMED,
  } });
  const unit = await prisma.bookingUnit.create({ data: {
    businessId, name: "Room " + suffix,
  } });
  const allocation = await prisma.bookingAllocation.create({ data: {
    bookingUnitId: unit.id, bookingRequestId: booking.id,
    blockStart: new Date("2025-01-01T11:00:00.000Z"),
    blockEnd: new Date("2025-01-01T12:00:00.000Z"),
    status: "CONFIRMED",
  } });
  const result = await closePastStandardBooking({
    businessId, bookingId: booking.id, actorId: ownerId,
    actorRole: "BUSINESS", outcome: { outcome: "NOT_HELD", reason: "CLIENT_NO_SHOW" },
  });
  assert.equal(result.status, BookingStatus.CANCELLED);
  assert.equal((await prisma.bookingAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).status, "RELEASED");
});
