import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { BookingStatus, PublicationType, type Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { updateBookingStatus } from "./bookingQuery.service";
import { BookingHoldExpiredError } from "./bookingHold";
import { closePastStandardBooking } from "./bookingOutcome.service";
import { lockBookingUnits } from "./resourceAllocation";

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

test("offer sessions, event sessions and request holds share the same PostgreSQL exclusion", async () => {
  await fixture();
  const place = await prisma.place.create({ data: {
    title: "Session venue " + suffix, shortDesc: "Test", ownerBusinessId: businessId,
    createdByUserId: ownerId, activityTypes: [], ageTags: [], visitFormats: [],
  } });
  const offer = await prisma.offer.create({ data: {
    kind: "SERVICE", productType: "REGULAR_ACTIVITY", title: "Group " + suffix, placeId: place.id,
  } });
  const activity = await prisma.activity.create({ data: {
    ownerUserId: ownerId, businessId, title: "Event " + suffix, shortDesc: "Test",
    type: "EVENT", scheduleMode: "ONE_TIME",
  } });
  const room = await prisma.bookingUnit.create({ data: { businessId, name: "Shared room " + suffix } });
  const blockStart = new Date(Date.now() + 86_400_000);
  const blockEnd = new Date(blockStart.getTime() + 3_600_000);
  try {
    const classSession = await prisma.offerSession.create({ data: {
      offerId: offer.id, startAt: blockStart, endAt: blockEnd, capacity: 2,
    } });
    const eventSession = await prisma.activitySession.create({ data: {
      activityId: activity.id, startsAt: blockStart,
    } });
    const booking = await prisma.bookingRequest.create({ data: {
      businessId, publicationType: PublicationType.OFFER, offerId: offer.id,
      offerSessionId: classSession.id, status: "CONFIRMED", ...contact,
    } });
    const allocation = { bookingUnitId: room.id, blockStart, blockEnd, status: "CONFIRMED" as const };
    const ownerError = /BookingAllocation_exactly_one_owner/;

    await assert.rejects(prisma.bookingAllocation.create({ data: allocation }), ownerError);
    await assert.rejects(prisma.bookingAllocation.create({ data: {
      ...allocation, bookingRequestId: booking.id, offerSessionId: classSession.id,
    } }), ownerError);
    await assert.rejects(prisma.bookingAllocation.create({ data: {
      ...allocation, activitySessionId: "missing-session-" + suffix,
    } }), /BookingAllocation_activitySessionId_fkey/);

    const reserve = (data: Prisma.BookingAllocationUncheckedCreateInput) =>
      prisma.$transaction(async (tx) => {
        assert.equal(await lockBookingUnits(tx, businessId, [room.id]), true);
        return tx.bookingAllocation.create({ data });
      });
    const attempts = await Promise.allSettled([
      reserve({ ...allocation, offerSessionId: classSession.id }),
      reserve({ ...allocation, activitySessionId: eventSession.id }),
      reserve({ ...allocation, bookingRequestId: booking.id, status: "HELD", expiresAt: blockStart }),
    ]);
    const winner = attempts.find((result) => result.status === "fulfilled");
    assert.ok(winner);
    const rejected = attempts.filter((result) => result.status === "rejected");
    assert.equal(rejected.length, 2);
    for (const result of rejected) assert.match(String(result.reason), /BookingAllocation_no_active_overlap/);

    await prisma.bookingAllocation.update({ where: { id: winner.value.id }, data: { status: "RELEASED" } });
    const fixed = await prisma.bookingAllocation.create({
      data: { ...allocation, offerSessionId: classSession.id },
    });
    await prisma.bookingRequest.delete({ where: { id: booking.id } });
    assert.equal((await prisma.bookingAllocation.findUniqueOrThrow({ where: { id: fixed.id } })).status, "CONFIRMED");
    await assert.rejects(prisma.offerSession.delete({ where: { id: classSession.id } }), /BookingAllocation_offerSessionId_fkey/);
  } finally {
    await prisma.bookingUnit.delete({ where: { id: room.id } });
    await prisma.bookingRequest.deleteMany({ where: { offerId: offer.id } });
    await prisma.offer.delete({ where: { id: offer.id } });
    await prisma.activity.delete({ where: { id: activity.id } });
    await prisma.place.delete({ where: { id: place.id } });
  }
});
