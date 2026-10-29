import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { BookingStatus, PrismaClient } from "@prisma/client";
import { updateBookingStatus } from "@/server/services/booking/bookingQuery.service";
import { reserveSlot, SlotReservationError } from "./reserveSlot";
import { saveBookingServices } from "./bookingServices.service";

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

test("server-calculated options and price snapshot persist atomically with additional unit", async () => {
  const room = await unit("Priced room");
  const projector = await unit("Priced projector");
  const offerId = await offer([room, projector]);
  const booking = await db.offerBooking.findUniqueOrThrow({ where: { offerId } });
  const edited = await saveBookingServices({
    offerId, businessId, data: {
      revision: 0, basePriceByn: "150.00",
      options: [
        { title: "Projector", mode: "OPTIONAL", priceByn: "25.50",
          bookingUnitId: projector, active: true },
        { title: "Setup", mode: "INCLUDED", priceByn: "0.00",
          bookingUnitId: null, active: true },
      ],
    },
  });
  assert.equal(edited.status, 200);
  const options = await db.offerBookingOption.findMany({
    where: { offerBookingId: booking.id }, orderBy: { position: "asc" },
  });
  const [optional, included] = options;
  assert.equal(optional.title, "Projector");
  assert.equal(included.mode, "INCLUDED");
  const result = await reserveSlot({
    offerId, startsAt: start, endsAt: end, unitId: room,
    selectedOptionIds: [optional.id], ...contact,
  });
  const row = await db.bookingRequest.findUniqueOrThrow({ where: { id: result.bookingId } });
  assert.equal(row.bookingTotalByn?.toString(), "175.5");
  const snapshot = row.bookingPriceSnapshot as {
    version: number; status: string; totalByn: string;
    options: Array<{ id: string; amountByn: string }>;
  };
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.status, "FIXED");
  assert.equal(snapshot.totalByn, "175.50");
  assert.deepEqual(snapshot.options.map(o => o.id).sort(), [optional.id, included.id].sort());
  assert.equal((await db.bookingAllocation.count({ where: { bookingRequestId: row.id } })), 2);

  // Repricing must never mutate the already accepted quote.
  assert.equal((await saveBookingServices({
    offerId, businessId, data: {
      revision: edited.revision!, basePriceByn: "150.00",
      options: [
        { id: optional.id, title: "Projector", mode: "OPTIONAL", priceByn: "90.00",
          bookingUnitId: projector, active: true },
        { id: included.id, title: "Setup", mode: "INCLUDED", priceByn: "0.00",
          bookingUnitId: null, active: true },
      ],
    },
  })).status, 200);
  const unchanged = await db.bookingRequest.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal((unchanged.bookingPriceSnapshot as { totalByn: string }).totalByn, "175.50");
  assert.equal(unchanged.bookingTotalByn?.toString(), "175.5");
});

test("paid option cannot become the only resource when main unit selection is ambiguous", async () => {
  const room = await unit("Main choice room");
  const equipment = await unit("Main choice equipment");
  const offerId = await offer([room, equipment]);
  const booking = await db.offerBooking.findUniqueOrThrow({ where: { offerId } });
  const extra = await db.offerBookingOption.create({ data: {
    offerBookingId: booking.id, title: "Extra equipment",
    mode: "OPTIONAL", priceByn: "15.00", bookingUnitId: equipment,
  } });
  await assert.rejects(reserveSlot({
    offerId, startsAt: start, endsAt: end,
    selectedOptionIds: [extra.id], ...contact,
  }), (error: unknown) => error instanceof SlotReservationError &&
    error.code === "UNIT_REQUIRED");
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 0);
  assert.equal(await db.bookingAllocation.count({ where: { bookingUnitId: equipment } }), 0);
});

test("unavailable selected option resource creates no partial booking or price snapshot", async () => {
  const room = await unit("Paid room");
  const equipment = await unit("Paid equipment");
  const offerId = await offer([room, equipment]);
  const booking = await db.offerBooking.findUniqueOrThrow({ where: { offerId } });
  const paid = await db.offerBookingOption.create({ data: {
    offerBookingId: booking.id, title: "Equipment", mode: "OPTIONAL",
    priceByn: "40.00", bookingUnitId: equipment,
  } });
  await db.calendarBlock.create({ data: {
    bookingUnitId: equipment, blockStart: start, blockEnd: end, source: "MANUAL",
  } });
  await assert.rejects(reserveSlot({
    offerId, startsAt: start, endsAt: end, unitId: room,
    selectedOptionIds: [paid.id], ...contact,
  }), (error: unknown) => error instanceof SlotReservationError &&
    error.code === "SLOT_UNAVAILABLE");
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 0);
  assert.equal(await db.bookingAllocation.count({ where: { bookingUnitId: room } }), 0);
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


test("services editor rejects stale edits and foreign business resources without side effects", async () => {
  const room = await unit("Editor guard room");
  const foreign = await unit("Unlinked editor resource");
  const offerId = await offer([room]);
  const base = { revision: 0, basePriceByn: "75.00", options: [] };
  assert.equal((await saveBookingServices({ offerId, businessId, data: base })).status, 200);
  assert.equal((await saveBookingServices({ offerId, businessId, data: base })).status, 409);
  const conflict = await saveBookingServices({
    offerId, businessId, data: {
      revision: 1, basePriceByn: "999.00",
      options: [{ title: "Foreign device", mode: "OPTIONAL",
        priceByn: "10.00", bookingUnitId: foreign, active: true }],
    },
  });
  assert.equal(conflict.status, 422);
  const booking = await db.offerBooking.findUniqueOrThrow({ where: { offerId } });
  assert.equal(booking.basePriceByn?.toString(), "75");
  assert.equal(booking.pricingRevision, 1);
  assert.equal(await db.offerBookingOption.count({ where: { offerBookingId: booking.id } }), 0);
  const wrongTenant = await saveBookingServices({
    offerId, businessId: "not-" + businessId, data: {
      revision: 1, basePriceByn: "999.00", options: [],
    },
  });
  assert.equal(wrongTenant.status, 404);
  assert.equal((await db.offerBooking.findUniqueOrThrow({ where: { offerId } })).pricingRevision, 1);
});

test("group offers cannot attach an exclusive resource to an add-on", async () => {
  const room = await unit("Group resource guard");
  const offerId = await offer([room]);
  await db.offerClassGroup.create({ data: { offerId, title: "Group with seats" } });
  const edited = await saveBookingServices({
    offerId, businessId, data: {
      revision: 0, basePriceByn: "35.00",
      options: [{ title: "Private room", mode: "OPTIONAL",
        priceByn: "10.00", bookingUnitId: room, active: true }],
    },
  });
  assert.equal(edited.status, 422);
  assert.equal(await db.offerBookingOption.count({ where: { offerBooking: { offerId } } }), 0);
});


test("resource-linked add-ons require ON_REQUEST_WINDOWS rather than just no class groups", async () => {
  const room = await unit("Scheduled resource guard");
  const offerId = await offer([room]);
  await db.offerBooking.update({
    where: { offerId }, data: { scheduleKind: "DATED_SESSIONS" },
  });
  const saved = await saveBookingServices({
    offerId, businessId, data: {
      revision: 0, basePriceByn: "20.00",
      options: [{
        title: "Projector", mode: "OPTIONAL", priceByn: "5.00",
        bookingUnitId: room, active: true,
      }],
    },
  });
  assert.equal(saved.status, 422);
  assert.equal(await db.offerBookingOption.count({
    where: { offerBooking: { offerId } },
  }), 0);
});

test("business may disable a linked add-on after the resource becomes inactive", async () => {
  const room = await unit("Inactive option room");
  const offerId = await offer([room]);
  const added = await saveBookingServices({ offerId, businessId, data: {
    revision: 0, basePriceByn: "25.00", options: [{
      title: "Projector", mode: "OPTIONAL", priceByn: "10.00",
      active: true, bookingUnitId: room,
    }],
  } });
  assert.equal(added.status, 200);
  const linked = await db.offerBookingOption.findFirstOrThrow({
    where: { offerBooking: { offerId } },
  });
  await db.bookingUnit.update({ where: { id: room }, data: { status: "INACTIVE" } });
  const disabled = await saveBookingServices({ offerId, businessId, data: {
    revision: added.revision!, basePriceByn: "25.00", options: [{
      id: linked.id, title: linked.title, mode: "OPTIONAL",
      priceByn: "10.00", active: false, bookingUnitId: room,
    }],
  } });
  assert.equal(disabled.status, 200);
  assert.equal((await db.offerBookingOption.findUniqueOrThrow({
    where: { id: linked.id },
  })).active, false);
});


test("same idempotency key serializes parallel retries and creates one allocation", async () => {
  const room = await unit("Idempotency guarded room");
  const offerId = await offer([room]);
  const idempotencyKey = randomUUID();
  const input = {
    offerId, unitId: room, startsAt: start, endsAt: end,
    ...contact, idempotencyKey, holdMinutes: 120,
  };
  const [first, retry] = await Promise.all([reserveSlot(input), reserveSlot(input)]);
  assert.equal(first.bookingId, retry.bookingId);
  assert.equal(first.holdUntil.toISOString(), retry.holdUntil.toISOString());
  assert.equal(Number(first.replayed) + Number(retry.replayed), 1);
  const saved = await db.bookingRequest.findUniqueOrThrow({ where: { id: first.bookingId } });
  assert.equal(saved.slotIdempotencyKey, idempotencyKey);
  assert.match(saved.slotRequestHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 1);
  assert.equal(await db.bookingAllocation.count({ where: { bookingRequestId: first.bookingId } }), 1);
  assert.equal(await db.bookingActivity.count({ where: { bookingId: first.bookingId, type: "CREATED" } }), 1);
});

test("idempotency key may not be reused for changed booking intent", async () => {
  const room = await unit("Idempotency conflict room");
  const offerId = await offer([room]);
  const input = { offerId, unitId: room, startsAt: start, endsAt: end,
    ...contact, idempotencyKey: randomUUID() };
  const original = await reserveSlot(input);
  await assert.rejects(reserveSlot({ ...input, customerPhone: "+375291119999" }),
    (error: unknown) => error instanceof SlotReservationError &&
      error.code === "INVALID_SLOT");
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 1);
  assert.equal((await reserveSlot(input)).bookingId, original.bookingId);
});

test("new idempotency key is a new booking attempt, not a replay", async () => {
  const room = await unit("Idempotency new attempt room");
  const offerId = await offer([room]);
  const input = { offerId, unitId: room, startsAt: start, endsAt: end,
    ...contact, idempotencyKey: randomUUID() };
  await reserveSlot(input);
  await assert.rejects(reserveSlot({ ...input, idempotencyKey: randomUUID() }),
    (error: unknown) => error instanceof SlotReservationError &&
      error.code === "SLOT_UNAVAILABLE");
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 1);
});

test("2-hour exclusive booking holds the full window and snapshots discounted extension price", async () => {
  const room = await unit("Hourly extension room");
  const offerId = await offer([room]);
  const edited = await saveBookingServices({ offerId, businessId, data: {
    revision: 0, basePriceByn: "100.00",
    maxExtensionHours: 2, extensionHourPriceByn: "60.00",
    extensionDiscountPercent: 10, options: [],
  } });
  assert.equal(edited.status, 200);
  const extendedEnd = new Date(end.getTime() + 60 * 60_000);
  const { bookingId } = await reserveSlot({
    offerId, unitId: room, startsAt: start, endsAt: extendedEnd, ...contact,
  });
  const booking = await db.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
  assert.equal(booking.bookingTotalByn?.toFixed(2), "154.00");
  const snapshot = booking.bookingPriceSnapshot as { durationMinutes: number;
    totalByn: string; extension: { hours: number; amountByn: string; discountPercent: number } };
  assert.equal(snapshot.durationMinutes, 120);
  assert.equal(snapshot.extension.hours, 1);
  assert.equal(snapshot.extension.amountByn, "54.00");
  assert.equal(snapshot.extension.discountPercent, 10);
  const allocation = await db.bookingAllocation.findFirstOrThrow({ where: { bookingRequestId: bookingId } });
  assert.equal(allocation.blockEnd.toISOString(), extendedEnd.toISOString());
  assert.equal((await saveBookingServices({ offerId, businessId, data: {
    revision: edited.revision!, basePriceByn: "150.00",
    maxExtensionHours: 2, extensionHourPriceByn: "100.00",
    extensionDiscountPercent: 0, options: [],
  } })).status, 200);
  const original = await db.bookingRequest.findUniqueOrThrow({ where: { id: bookingId } });
  assert.equal(original.bookingTotalByn?.toFixed(2), "154.00");
});

test("extension not configured or longer than hourly cap cannot create a booking", async () => {
  const room = await unit("Extension validation room");
  const offerId = await offer([room]);
  const invalidEnds = [new Date(end.getTime() + 30 * 60_000), new Date(end.getTime() + 60 * 60_000)];
  for (const endsAt of invalidEnds) {
    await assert.rejects(reserveSlot({
      offerId, unitId: room, startsAt: start, endsAt, ...contact,
    }), (error: unknown) => error instanceof SlotReservationError && error.code === "INVALID_SLOT");
  }
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 0);
});

test("manual block in extension hour rejects entire booking, never only the extra time", async () => {
  const room = await unit("Extension conflict room");
  const offerId = await offer([room]);
  assert.equal((await saveBookingServices({ offerId, businessId, data: {
    revision: 0, basePriceByn: "60.00", maxExtensionHours: 1,
    extensionHourPriceByn: "25.00", extensionDiscountPercent: 0, options: [],
  } })).status, 200);
  await db.calendarBlock.create({ data: {
    bookingUnitId: room, blockStart: end,
    blockEnd: new Date(end.getTime() + 60 * 60_000), source: "MANUAL",
  } });
  await assert.rejects(reserveSlot({ offerId, unitId: room, startsAt: start,
    endsAt: new Date(end.getTime() + 60 * 60_000), ...contact }),
    (error: unknown) => error instanceof SlotReservationError && error.code === "SLOT_UNAVAILABLE");
  assert.equal(await db.bookingRequest.count({ where: { offerId } }), 0);
  assert.equal(await db.bookingAllocation.count({ where: { bookingUnitId: room } }), 0);
});
