import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import prisma from "@/lib/prisma";
import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { createManualBooking } from "./booking.service";
import { updateBookingStatus } from "./bookingQuery.service";

const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Manual resource integration tests require disposable localhost PostgreSQL");
}

const suffix = randomUUID();
const userId = "manual-unit-" + suffix;
let businessId = "";
let placeId = "";
let unitId = "";

after(async () => {
  if (businessId) {
    await prisma.bookingRequest.deleteMany({ where: { businessId } });
    await prisma.bookingUnit.deleteMany({ where: { businessId } });
  }
  if (placeId) await prisma.place.delete({ where: { id: placeId } });
  if (businessId) await prisma.business.delete({ where: { id: businessId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function fixture() {
  await prisma.user.create({ data: { id: userId, email: userId + "@example.test" } });
  businessId = (await prisma.business.create({
    data: { ownerUserId: userId, name: "Manual resource integration " + suffix },
  })).id;
  placeId = (await prisma.place.create({ data: {
    title: "Room " + suffix, shortDesc: "Test", ownerBusinessId: businessId,
    createdByUserId: userId, activityTypes: [], ageTags: [], visitFormats: [],
    status: "PUBLISHED", bookingEnabled: true,
  } })).id;
  unitId = (await prisma.bookingUnit.create({ data: {
    businessId, name: "Solo worker " + suffix,
    prepMinutes: 15, cleanupMinutes: 15, minDurationMinutes: 30,
    rules: { create: Array.from({ length: 7 }, (_, n) => ({
      weekday: n + 1, startMinutes: 600, endMinutes: 1320,
    })) },
  } })).id;
}

test("confirmed manual PLACE appointment owns one physical allocation and reuses idempotency", async () => {
  await fixture();
  const date = addDaysLocal(getLocalDateKey(), 7);
  const start = localWallClockToUtc(date, "14:00");
  const end = new Date(start.getTime() + 90 * 60_000);
  const requestKey = randomUUID();
  const input = {
    publicationType: "PLACE" as const, publicationId: placeId,
    requestedDate: date, requestedTime: "14:00",
    customerName: "Test Customer", customerPhone: "+375291112233",
    status: "CONFIRMED" as const,
    resourceReservation: {
      bookingUnitId: unitId, startsAt: start.toISOString(), endsAt: end.toISOString(),
    },
  };
  const ctx = { businessId, actorId: userId, requestKey };
  const first = await createManualBooking(input, ctx);
  assert.equal(first.status, "CONFIRMED");
  const replay = await createManualBooking(input, ctx);
  assert.deepEqual(replay, first);
  const rows = await prisma.bookingRequest.findMany({ where: { id: first.bookingId } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.source, "MANUAL");
  assert.equal(rows[0]?.startsAt?.getTime(), start.getTime());
  assert.equal(rows[0]?.endsAt?.getTime(), end.getTime());
  const allocations = await prisma.bookingAllocation.findMany({
    where: { bookingRequestId: first.bookingId },
  });
  assert.equal(allocations.length, 1);
  assert.equal(allocations[0]?.bookingUnitId, unitId);
  assert.equal(allocations[0]?.status, "CONFIRMED");
  assert.equal(allocations[0]?.blockStart.getTime(), start.getTime() - 15 * 60_000);
  assert.equal(allocations[0]?.blockEnd.getTime(), end.getTime() + 15 * 60_000);

  const competing = {
    ...input, customerPhone: "+375291112234",
    resourceReservation: {
      bookingUnitId: unitId,
      startsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
      endsAt: new Date(end.getTime() + 30 * 60_000).toISOString(),
    },
    requestedTime: "14:30",
  };
  await assert.rejects(
    createManualBooking(competing, { ...ctx, requestKey: randomUUID() }),
    /занят|недоступен/,
  );
  assert.equal(await prisma.bookingRequest.count({ where: { placeId, status: "CONFIRMED" } }), 1);

  await assert.rejects(
    createManualBooking({
      ...input,
      customerPhone: "+375291112235",
    }, { businessId: "foreign-business-id", actorId: userId, requestKey: randomUUID() }),
    /не принадлежит|недоступен/,
  );

  await updateBookingStatus(first.bookingId, businessId, "REJECTED");
  assert.equal((await prisma.bookingAllocation.findUniqueOrThrow({
    where: { id: allocations[0]!.id },
  })).status, "RELEASED");
  const second = await createManualBooking(competing, { ...ctx, requestKey: randomUUID() });
  assert.equal(second.status, "CONFIRMED");
});
