import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { BookingStatus, PrismaClient } from "@prisma/client";
import { updateBookingStatus } from "@/server/services/booking/bookingQuery.service";
import { reserveSlot, SlotReservationError } from "./reserveSlot";

const url = process.env.DATABASE_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
  throw new Error("Multi-resource booking tests require disposable localhost PostgreSQL DATABASE_URL");
}
const db = new PrismaClient({ datasourceUrl: url });
const run = randomUUID().slice(0, 8);
const ownerId = `multi-owner-${run}`;
const offerIds: string[] = [];
const unitIds: string[] = [];
let businessId = "";
let placeId = "";
const start = (() => {
  const today = new Date();
  let days = (2 - today.getUTCDay() + 7) % 7;
  if (days < 2) days += 7;
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days, 7));
})();
const end = new Date(start.getTime() + 60 * 60_000);
const contact = { customerName: "Test Parent", customerPhone: "+375291112233" };

after(async () => {
  try {
    if (offerIds.length) await db.bookingRequest.deleteMany({ where: { offerId: { in: offerIds } } });
    if (offerIds.length) await db.offer.deleteMany({ where: { id: { in: offerIds } } });
    if (unitIds.length) await db.bookingUnit.deleteMany({ where: { id: { in: unitIds } } });
    if (placeId) await db.place.delete({ where: { id: placeId } });
    if (businessId) await db.business.delete({ where: { id: businessId } });
    await db.user.deleteMany({ where: { id: ownerId } });
  } finally { await db.$disconnect(); }
});

async function fixture() {
  if (businessId) return;
  await db.user.create({ data: { id: ownerId, email: ownerId + "@example.test" } });
  businessId = (await db.business.create({ data: {
    name: "multi-resource-" + run, ownerUserId: ownerId,
  } })).id;
  placeId = (await db.place.create({ data: {
    title: "Multi-resource test " + run, shortDesc: "Test place",
    createdByUserId: ownerId, ownerBusinessId: businessId,
    activityTypes: [], ageTags: [], visitFormats: [],
  } })).id;
}

async function unit(name: string, prepMinutes = 0, cleanupMinutes = 0) {
  await fixture();
  const created = await db.bookingUnit.create({ data: {
    businessId, placeId, name: name + run, timezone: "Europe/Minsk",
    prepMinutes, cleanupMinutes, stepMinutes: 15,
    rules: { create: { weekday: 2, startMinutes: 600, endMinutes: 720 } },
  } });
  unitIds.push(created.id);
  return created.id;
}

async function offer(resources: string[]) {
  await fixture();
  const created = await db.offer.create({ data: {
    kind: "SERVICE", productType: "PARTY_SERVICE", title: "Multi-resource " + run,
    placeId, status: "PUBLISHED", bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_SLOTS",
    offerBooking: { create: { scheduleKind: "ON_REQUEST_WINDOWS", durationMin: 60, leadTimeHours: 0 } },
  } });
  offerIds.push(created.id);
  for (const bookingUnitId of resources) {
    await db.bookingUnitOffer.create({ data: { bookingUnitId, offerId: created.id } });
  }
  return created.id;
}

test("a room and equipment are held atomically with individual prep/cleanup windows", async () => {
  const room = await unit("Room", 30, 0);
  const equipment = await unit("Equipment", 0, 15);
  const offerId = await offer([room, equipment]);
  const { bookingId, holdUntil } = await reserveSlot({
    offerId, startsAt: start, endsAt: end, unitIds: [equipment, room], ...contact,
  });
  const allocations = await db.bookingAllocation.findMany({
    where: { bookingRequestId: bookingId }, orderBy: { bookingUnitId: "asc" },
  });
  assert.equal(allocations.length, 2);
  assert.deepEqual(allocations.map(a => a.bookingUnitId).sort(), [room, equipment].sort());
  assert.ok(allocations.every(a => a.status === "HELD" &&
    a.expiresAt?.getTime() === holdUntil.getTime()));
  const byId = new Map(allocations.map(a => [a.bookingUnitId, a]));
  assert.equal(byId.get(room)?.blockStart.getTime(), start.getTime() - 30 * 60_000);
  assert.equal(byId.get(room)?.blockEnd.getTime(), end.getTime());
  assert.equal(byId.get(equipment)?.blockStart.getTime(), start.getTime());
  assert.equal(byId.get(equipment)?.blockEnd.getTime(), end.getTime() + 15 * 60_000);
  assert.equal(await db.bookingRequest.count({ where: { id: bookingId, status: "NEW" } }), 1);
});

test("business confirmation and rejection transition ALL held bundle resources", async () => {
  const room = await unit("Transition room");
  const equipment = await unit("Transition equipment");
  const offerId = await offer([room, equipment]);
  const { bookingId } = await reserveSlot({
    offerId, startsAt: start, endsAt: end, unitIds: [room, equipment], ...contact,
  });
  await updateBookingStatus(bookingId, businessId, BookingStatus.CONFIRMED);
  const confirmed = await db.bookingAllocation.findMany({ where: { bookingRequestId: bookingId } });
  assert.equal(confirmed.length, 2);
  assert.ok(confirmed.every(a => a.status === "CONFIRMED" && a.expiresAt === null));
  await updateBookingStatus(bookingId, businessId, BookingStatus.REJECTED);
  const released = await db.bookingAllocation.findMany({ where: { bookingRequestId: bookingId } });
  assert.equal(released.length, 2);
  assert.ok(released.every(a => a.status === "RELEASED" && a.expiresAt === null));
  assert.equal((await db.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } })).status, "REJECTED");
});

test("an occupied required resource rejects the bundle without booking or partial hold", async () => {
  const room = await unit("Blocked room");
  const equipment = await unit("Blocked equipment");
  const offerId = await offer([room, equipment]);
  await db.calendarBlock.create({ data: {
    bookingUnitId: equipment, blockStart: start, blockEnd: end, source: "MANUAL",
  } });
  await assert.rejects(reserveSlot({
    offerId, startsAt: start, endsAt: end, unitIds: [room, equipment], ...contact,
  }), (error: unknown) => error instanceof SlotReservationError && error.code === "SLOT_UNAVAILABLE");
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 0);
  assert.equal(await db.bookingAllocation.count({ where: { bookingUnitId: room } }), 0);
});

test("two offers requesting the same bundle in reverse order cannot double-book", async () => {
  const room = await unit("Concurrent room");
  const equipment = await unit("Concurrent equipment");
  const first = await offer([room, equipment]);
  const second = await offer([room, equipment]);
  const results = await Promise.allSettled([
    reserveSlot({ offerId: first, startsAt: start, endsAt: end, unitIds: [room, equipment], ...contact }),
    reserveSlot({ offerId: second, startsAt: start, endsAt: end, unitIds: [equipment, room], ...contact }),
  ]);
  const successes = results.filter(result => result.status === "fulfilled");
  assert.equal(successes.length, 1);
  const failures = results.filter(result => result.status === "rejected");
  assert.equal(failures.length, 1);
  assert.ok(failures[0].status === "rejected" &&
    failures[0].reason instanceof SlotReservationError &&
    failures[0].reason.code === "SLOT_UNAVAILABLE");
  assert.equal(await db.bookingRequest.count({ where: { offerId: { in: [first, second] } } }), 1);
  const allocations = await db.bookingAllocation.findMany({
    where: { bookingUnitId: { in: [room, equipment] }, status: "HELD" },
  });
  assert.equal(allocations.length, 2);
  assert.equal(new Set(allocations.map(a => a.bookingRequestId)).size, 1);
});

test("duplicate or mixed resource selectors fail before any mutation", async () => {
  const room = await unit("Validation room");
  const offerId = await offer([room]);
  for (const selection of [
    { unitIds: [] }, { unitIds: [room, room] }, { unitId: room, unitIds: [room] },
  ]) {
    await assert.rejects(reserveSlot({
      offerId, startsAt: start, endsAt: end, ...selection, ...contact,
    }), (error: unknown) => error instanceof SlotReservationError && error.code === "INVALID_SLOT");
  }
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 0);
});

test("an unlinked resource may not be included in a required bundle", async () => {
  const linked = await unit("Linked");
  const unlinked = await unit("Unlinked");
  const offerId = await offer([linked]);
  await assert.rejects(reserveSlot({
    offerId, startsAt: start, endsAt: end, unitIds: [linked, unlinked], ...contact,
  }), (error: unknown) => error instanceof SlotReservationError && error.code === "SLOT_UNAVAILABLE");
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 0);
});
