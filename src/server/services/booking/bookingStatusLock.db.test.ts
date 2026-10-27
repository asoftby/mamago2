/**
 * PostgreSQL concurrency regression for the row-lock protocol used by
 * updateBookingStatus(). Run against an isolated integration database:
 *   RUN_BOOKING_LOCK_DB_TEST=1 pnpm exec tsx src/server/services/booking/bookingStatusLock.db.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { BookingStatus, PublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";

test("only one concurrent status transition can consume NEW", {
  skip: process.env.RUN_BOOKING_LOCK_DB_TEST !== "1" ? "requires isolated PostgreSQL fixture" : false,
}, async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
    throw new Error("This test requires a disposable localhost PostgreSQL database");
  }
  const ownerId = `booking-lock-${randomUUID()}`;
  await prisma.user.create({ data: { id: ownerId, email: `${ownerId}@example.test` } });
  const business = await prisma.business.create({ data: { name: ownerId, ownerUserId: ownerId } });
  const booking = await prisma.bookingRequest.create({
    data: {
      businessId: business.id,
      publicationType: PublicationType.OFFER,
      customerName: "Booking lock integration test",
      customerPhone: "+375291234567",
      status: BookingStatus.NEW,
    },
    select: { id: true },
  });
  try {
    async function attempt(next: BookingStatus) {
      return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "BookingRequest" WHERE "id" = ${booking.id} FOR UPDATE`;
        const current = await tx.bookingRequest.findUniqueOrThrow({
          where: { id: booking.id },
          select: { status: true },
        });
        if (current.status !== BookingStatus.NEW) return false;
        const updated = await tx.bookingRequest.updateMany({
          where: { id: booking.id, status: BookingStatus.NEW },
          data: { status: next },
        });
        return updated.count === 1;
      }, { timeout: 30_000 });
    }
    const outcomes = await Promise.all([
      attempt(BookingStatus.CONFIRMED),
      attempt(BookingStatus.REJECTED),
    ]);
    assert.equal(outcomes.filter(Boolean).length, 1, "only one transition may succeed");
    const persisted = await prisma.bookingRequest.findUniqueOrThrow({
      where: { id: booking.id },
      select: { status: true },
    });
    assert.ok([BookingStatus.CONFIRMED, BookingStatus.REJECTED].includes(persisted.status));
  } finally {
    await prisma.bookingRequest.delete({ where: { id: booking.id } });
    await prisma.business.delete({ where: { id: business.id } });
    await prisma.user.delete({ where: { id: ownerId } });
  }
});
