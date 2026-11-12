import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import prisma from "@/lib/prisma";
import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { createManualBooking } from "./booking.service";
import { updateBookingStatus } from "./bookingQuery.service";
import { lockBookingUnits } from "./resourceAllocation";

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
    await prisma.calendarBlock.deleteMany({ where: { bookingUnit: { businessId } } });
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

  const appointment = (day: string, phone: string) => {
    const startsAt = localWallClockToUtc(day, "14:00");
    return {
      ...input, requestedDate: day, customerPhone: phone,
      resourceReservation: { bookingUnitId: unitId, startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 90 * 60_000).toISOString() },
    };
  };
  const raceDate = addDaysLocal(date, 1);
  const race = await Promise.allSettled([
    createManualBooking(appointment(raceDate, "+375291112241"), { ...ctx, requestKey: randomUUID() }),
    createManualBooking(appointment(raceDate, "+375291112242"), { ...ctx, requestKey: randomUUID() }),
  ]);
  assert.equal(race.filter(x => x.status === "fulfilled").length, 1,
    "simultaneous overlapping PLACE appointments must have exactly one winner");
  assert.equal(await prisma.bookingAllocation.count({ where: { bookingUnitId: unitId,
    blockStart: { gte: new Date(raceDate), lt: new Date(addDaysLocal(raceDate, 1)) } } }), 1);

  // Exercise the same locked manual CalendarBlock protocol used by the route.
  // The route's ACL and lock-before-overlap contract have separate coverage.
  const blockDate = addDaysLocal(date, 2);
  const blockStart = localWallClockToUtc(blockDate, "14:00");
  const blockEnd = new Date(blockStart.getTime() + 90 * 60_000);
  const blockRace = await Promise.allSettled([
    createManualBooking(appointment(blockDate, "+375291112243"), { ...ctx, requestKey: randomUUID() }),
    prisma.$transaction(async tx => {
      assert.equal(await lockBookingUnits(tx, businessId, [unitId]), true);
      const occupied = await tx.bookingAllocation.findFirst({ where: {
        bookingUnitId: unitId, status: "CONFIRMED", blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart },
      } });
      if (occupied) throw new Error("manual_block_conflict");
      return tx.calendarBlock.create({ data: { bookingUnitId: unitId, blockStart, blockEnd, source: "MANUAL" } });
    }),
  ]);
  assert.equal(blockRace.filter(x => x.status === "fulfilled").length, 1,
    "a booking and an overlapping manual block must not both commit");
  const blockWindow = { bookingUnitId: unitId, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart } };
  assert.equal(await prisma.calendarBlock.count({ where: blockWindow }) +
    await prisma.bookingAllocation.count({ where: { ...blockWindow, status: "CONFIRMED" } }), 1);

  // Force a real DB failure only at allocation INSERT, after BookingRequest
  // and its initial BookingActivity were written inside the same transaction.
  const rollbackKey = randomUUID();
  const functionName = "manual_place_fail_" + suffix.replaceAll("-", "");
  assert.match(unitId, /^[a-zA-Z0-9_-]+$/);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN RAISE EXCEPTION 'synthetic_allocation_failure'; END $bodyimport assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import prisma from "@/lib/prisma";
import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { createManualBooking } from "./booking.service";
import { updateBookingStatus } from "./bookingQuery.service";
import { lockBookingUnits } from "./resourceAllocation";

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
    await prisma.calendarBlock.deleteMany({ where: { bookingUnit: { businessId } } });
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

  const appointment = (day: string, phone: string) => {
    const startsAt = localWallClockToUtc(day, "14:00");
    return {
      ...input, requestedDate: day, customerPhone: phone,
      resourceReservation: { bookingUnitId: unitId, startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 90 * 60_000).toISOString() },
    };
  };
  const raceDate = addDaysLocal(date, 1);
  const race = await Promise.allSettled([
    createManualBooking(appointment(raceDate, "+375291112241"), { ...ctx, requestKey: randomUUID() }),
    createManualBooking(appointment(raceDate, "+375291112242"), { ...ctx, requestKey: randomUUID() }),
  ]);
  assert.equal(race.filter(x => x.status === "fulfilled").length, 1,
    "simultaneous overlapping PLACE appointments must have exactly one winner");
  assert.equal(await prisma.bookingAllocation.count({ where: { bookingUnitId: unitId,
    blockStart: { gte: new Date(raceDate), lt: new Date(addDaysLocal(raceDate, 1)) } } }), 1);

  // Exercise the same locked manual CalendarBlock protocol used by the route.
  // The route's ACL and lock-before-overlap contract have separate coverage.
  const blockDate = addDaysLocal(date, 2);
  const blockStart = localWallClockToUtc(blockDate, "14:00");
  const blockEnd = new Date(blockStart.getTime() + 90 * 60_000);
  const blockRace = await Promise.allSettled([
    createManualBooking(appointment(blockDate, "+375291112243"), { ...ctx, requestKey: randomUUID() }),
    prisma.$transaction(async tx => {
      assert.equal(await lockBookingUnits(tx, businessId, [unitId]), true);
      const occupied = await tx.bookingAllocation.findFirst({ where: {
        bookingUnitId: unitId, status: "CONFIRMED", blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart },
      } });
      if (occupied) throw new Error("manual_block_conflict");
      return tx.calendarBlock.create({ data: { bookingUnitId: unitId, blockStart, blockEnd, source: "MANUAL" } });
    }),
  ]);
  assert.equal(blockRace.filter(x => x.status === "fulfilled").length, 1,
    "a booking and an overlapping manual block must not both commit");
  const blockWindow = { bookingUnitId: unitId, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart } };
  assert.equal(await prisma.calendarBlock.count({ where: blockWindow }) +
    await prisma.bookingAllocation.count({ where: { ...blockWindow, status: "CONFIRMED" } }), 1);

  // Force a real DB failure only at allocation INSERT, after BookingRequest
  // and its initial BookingActivity were written inside the same transaction.
  const rollbackKey = randomUUID();
  const functionName = "manual_place_fail_" + suffix.replaceAll("-", "");
  assert.match(unitId, /^[a-zA-Z0-9_-]+$/);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN RAISE EXCEPTION 'synthetic_allocation_failure'; END;
  $bodyimport assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import prisma from "@/lib/prisma";
import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { createManualBooking } from "./booking.service";
import { updateBookingStatus } from "./bookingQuery.service";
import { lockBookingUnits } from "./resourceAllocation";

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
    await prisma.calendarBlock.deleteMany({ where: { bookingUnit: { businessId } } });
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

  const appointment = (day: string, phone: string) => {
    const startsAt = localWallClockToUtc(day, "14:00");
    return {
      ...input, requestedDate: day, customerPhone: phone,
      resourceReservation: { bookingUnitId: unitId, startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 90 * 60_000).toISOString() },
    };
  };
  const raceDate = addDaysLocal(date, 1);
  const race = await Promise.allSettled([
    createManualBooking(appointment(raceDate, "+375291112241"), { ...ctx, requestKey: randomUUID() }),
    createManualBooking(appointment(raceDate, "+375291112242"), { ...ctx, requestKey: randomUUID() }),
  ]);
  assert.equal(race.filter(x => x.status === "fulfilled").length, 1,
    "simultaneous overlapping PLACE appointments must have exactly one winner");
  assert.equal(await prisma.bookingAllocation.count({ where: { bookingUnitId: unitId,
    blockStart: { gte: new Date(raceDate), lt: new Date(addDaysLocal(raceDate, 1)) } } }), 1);

  // Exercise the same locked manual CalendarBlock protocol used by the route.
  // The route's ACL and lock-before-overlap contract have separate coverage.
  const blockDate = addDaysLocal(date, 2);
  const blockStart = localWallClockToUtc(blockDate, "14:00");
  const blockEnd = new Date(blockStart.getTime() + 90 * 60_000);
  const blockRace = await Promise.allSettled([
    createManualBooking(appointment(blockDate, "+375291112243"), { ...ctx, requestKey: randomUUID() }),
    prisma.$transaction(async tx => {
      assert.equal(await lockBookingUnits(tx, businessId, [unitId]), true);
      const occupied = await tx.bookingAllocation.findFirst({ where: {
        bookingUnitId: unitId, status: "CONFIRMED", blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart },
      } });
      if (occupied) throw new Error("manual_block_conflict");
      return tx.calendarBlock.create({ data: { bookingUnitId: unitId, blockStart, blockEnd, source: "MANUAL" } });
    }),
  ]);
  assert.equal(blockRace.filter(x => x.status === "fulfilled").length, 1,
    "a booking and an overlapping manual block must not both commit");
  const blockWindow = { bookingUnitId: unitId, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart } };
  assert.equal(await prisma.calendarBlock.count({ where: blockWindow }) +
    await prisma.bookingAllocation.count({ where: { ...blockWindow, status: "CONFIRMED" } }), 1);

  // Force a real DB failure only at allocation INSERT, after BookingRequest
  // and its initial BookingActivity were written inside the same transaction.
  const rollbackKey = randomUUID();
  const functionName = "manual_place_fail_" + suffix.replaceAll("-", "");
  assert.match(unitId, /^[a-zA-Z0-9_-]+$/);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN RAISE EXCEPTION 'synthetic_allocation_failure'; END $bodyimport assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import prisma from "@/lib/prisma";
import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { createManualBooking } from "./booking.service";
import { updateBookingStatus } from "./bookingQuery.service";
import { lockBookingUnits } from "./resourceAllocation";

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
    await prisma.calendarBlock.deleteMany({ where: { bookingUnit: { businessId } } });
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

  const appointment = (day: string, phone: string) => {
    const startsAt = localWallClockToUtc(day, "14:00");
    return {
      ...input, requestedDate: day, customerPhone: phone,
      resourceReservation: { bookingUnitId: unitId, startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 90 * 60_000).toISOString() },
    };
  };
  const raceDate = addDaysLocal(date, 1);
  const race = await Promise.allSettled([
    createManualBooking(appointment(raceDate, "+375291112241"), { ...ctx, requestKey: randomUUID() }),
    createManualBooking(appointment(raceDate, "+375291112242"), { ...ctx, requestKey: randomUUID() }),
  ]);
  assert.equal(race.filter(x => x.status === "fulfilled").length, 1,
    "simultaneous overlapping PLACE appointments must have exactly one winner");
  assert.equal(await prisma.bookingAllocation.count({ where: { bookingUnitId: unitId,
    blockStart: { gte: new Date(raceDate), lt: new Date(addDaysLocal(raceDate, 1)) } } }), 1);

  // Exercise the same locked manual CalendarBlock protocol used by the route.
  // The route's ACL and lock-before-overlap contract have separate coverage.
  const blockDate = addDaysLocal(date, 2);
  const blockStart = localWallClockToUtc(blockDate, "14:00");
  const blockEnd = new Date(blockStart.getTime() + 90 * 60_000);
  const blockRace = await Promise.allSettled([
    createManualBooking(appointment(blockDate, "+375291112243"), { ...ctx, requestKey: randomUUID() }),
    prisma.$transaction(async tx => {
      assert.equal(await lockBookingUnits(tx, businessId, [unitId]), true);
      const occupied = await tx.bookingAllocation.findFirst({ where: {
        bookingUnitId: unitId, status: "CONFIRMED", blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart },
      } });
      if (occupied) throw new Error("manual_block_conflict");
      return tx.calendarBlock.create({ data: { bookingUnitId: unitId, blockStart, blockEnd, source: "MANUAL" } });
    }),
  ]);
  assert.equal(blockRace.filter(x => x.status === "fulfilled").length, 1,
    "a booking and an overlapping manual block must not both commit");
  const blockWindow = { bookingUnitId: unitId, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart } };
  assert.equal(await prisma.calendarBlock.count({ where: blockWindow }) +
    await prisma.bookingAllocation.count({ where: { ...blockWindow, status: "CONFIRMED" } }), 1);

  // Force a real DB failure only at allocation INSERT, after BookingRequest
  // and its initial BookingActivity were written inside the same transaction.
  const rollbackKey = randomUUID();
  const functionName = "manual_place_fail_" + suffix.replaceAll("-", "");
  assert.match(unitId, /^[a-zA-Z0-9_-]+$/);
  );
  try {
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${functionName}" BEFORE INSERT ON "BookingAllocation"
      FOR EACH ROW WHEN (NEW."bookingUnitId" = '${unitId}') EXECUTE FUNCTION "${functionName}"()`);
    const beforeActivities = await prisma.bookingActivity.count({ where: { booking: { businessId } } });
    await assert.rejects(createManualBooking(appointment(addDaysLocal(date, 3), "+375291112244"),
      { ...ctx, requestKey: rollbackKey }), /synthetic_allocation_failure/);
    assert.equal(await prisma.bookingRequest.count({ where: { businessId, manualRequestKey: rollbackKey } }), 0,
      "failed allocation rolls back its booking request");
    assert.equal(await prisma.bookingActivity.count({ where: { booking: { businessId } } }), beforeActivities,
      "failed allocation rolls back its initial activity");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${functionName}" ON "BookingAllocation"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
  }
});
