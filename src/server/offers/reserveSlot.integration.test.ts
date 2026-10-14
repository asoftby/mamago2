import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { projectCampSessions } from "./campSessionProjection";
import { expireOfferHolds } from "./expireOfferHolds";
import { loadSlotSnapshot } from "./getSlots";
import { reserveSlot, SlotReservationError } from "./reserveSlot";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("reserveSlot integration tests require a disposable localhost PostgreSQL DATABASE_URL");
}
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const nextTuesday = (() => {
  const today = new Date();
  let days = (2 - today.getUTCDay() + 7) % 7;
  if (days < 2) days += 7;
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days, 7));
})();
const nextTuesdayEnd = new Date(nextTuesday.getTime() + 60 * 60_000);
const ownerId = `slot-owner-${run}`;
let businessId = "";
let placeId = "";
const offerIds: string[] = [];
const unitIds: string[] = [];

after(async () => {
  if (offerIds.length) await db.bookingRequest.deleteMany({ where: { offerId: { in: offerIds } } });
  if (offerIds.length) await db.offer.deleteMany({ where: { id: { in: offerIds } } });
  if (unitIds.length) await db.bookingUnit.deleteMany({ where: { id: { in: unitIds } } });
  if (placeId) await db.place.delete({ where: { id: placeId } });
  if (businessId) await db.business.delete({ where: { id: businessId } });
  await db.user.deleteMany({ where: { id: ownerId } });
  await db.$disconnect();
});

async function fixture() {
  if (businessId) return;
  await db.user.create({ data: { id: ownerId, email: `${ownerId}@example.test` } });
  businessId = (await db.business.create({ data: { name: `slot-${run}`, ownerUserId: ownerId } })).id;
  placeId = (await db.place.create({ data: {
    title: `Slot place ${run}`, shortDesc: "Test place", createdByUserId: ownerId,
    ownerBusinessId: businessId, activityTypes: [], ageTags: [], visitFormats: [],
  } })).id;
}

async function groupOffer() {
  await fixture();
  const startAt = nextTuesday;
  const endAt = nextTuesdayEnd;
  const offer = await db.offer.create({ data: {
    kind: "SERVICE", productType: "ONE_TIME_ACTIVITY", title: `Group ${run}`,
    placeId, status: "PUBLISHED", bookingEnabled: true, bookingMode: "USE_PUBLICATION_DATES",
    offerBooking: { create: { scheduleKind: "DATED_SESSIONS", leadTimeHours: 0, capacity: 1 } },
    sessions: { create: { startAt, endAt, capacity: 1 } },
  } });
  offerIds.push(offer.id);
  return { offerId: offer.id, startAt, endAt };
}

async function resourceOffer(unitId: string) {
  const offer = await db.offer.create({ data: {
    kind: "SERVICE", productType: "PARTY_SERVICE", title: `Party ${run}`,
    placeId, status: "PUBLISHED", bookingEnabled: true, bookingMode: "USE_PUBLICATION_SLOTS",
    offerBooking: { create: { scheduleKind: "ON_REQUEST_WINDOWS", durationMin: 60, leadTimeHours: 0 } },
  } });
  offerIds.push(offer.id);
  await db.bookingUnitOffer.create({ data: { bookingUnitId: unitId, offerId: offer.id } });
  return offer.id;
}

const contact = { customerName: "Test Parent", customerPhone: "+375291112233" };

test("two concurrent group reservations cannot take the final seat", async () => {
  const { offerId, startAt, endAt } = await groupOffer();
  const input = { offerId, startsAt: startAt, endsAt: endAt, ...contact };
  const outcomes = await Promise.allSettled([reserveSlot(input), reserveSlot(input)]);
  assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
  const failure = outcomes.find((item) => item.status === "rejected");
  assert.ok(failure && failure.status === "rejected");
  assert.ok(failure.reason instanceof SlotReservationError);
  assert.equal(failure.reason.code, "SLOT_UNAVAILABLE");
  assert.equal(await db.bookingRequest.count({ where: { offerId, status: "NEW" } }), 1);
});

test("expired resource hold is released before a new reservation", async () => {
  await fixture();
  const unit = await db.bookingUnit.create({ data: {
    businessId, placeId, name: `Room ${run}`, timezone: "Europe/Minsk", stepMinutes: 15,
    rules: { create: { weekday: 2, startMinutes: 600, endMinutes: 720 } },
  } });
  unitIds.push(unit.id);
  const offerId = await resourceOffer(unit.id);
  const startAt = nextTuesday;
  const endAt = nextTuesdayEnd;
  const old = await db.bookingRequest.create({ data: {
    businessId, publicationType: "OFFER", offerId, customerName: "Old", customerPhone: contact.customerPhone,
    startsAt: startAt, endsAt: endAt, holdUntil: new Date(Date.now() - 86_400_000),
  } });
  const expired = await db.bookingAllocation.create({ data: {
    bookingUnitId: unit.id, bookingRequestId: old.id, blockStart: startAt, blockEnd: endAt,
    status: "HELD", expiresAt: new Date(Date.now() - 86_400_000),
  } });
  const result = await reserveSlot({ offerId, startsAt: startAt, endsAt: endAt, unitId: unit.id, ...contact });
  assert.ok(result.bookingId);
  assert.equal((await db.bookingAllocation.findUniqueOrThrow({ where: { id: expired.id } })).status, "EXPIRED");
  assert.equal(await db.bookingAllocation.count({ where: { bookingUnitId: unit.id, status: "HELD" } }), 1);
  const cleanup = await expireOfferHolds(db);
  assert.equal(cleanup.requests, 1);
  assert.equal((await db.bookingRequest.findUniqueOrThrow({ where: { id: old.id } })).status, "EXPIRED");
  assert.equal((await db.bookingRequest.findUniqueOrThrow({ where: { id: result.bookingId } })).status, "NEW");
});

test("existing party allocation and offer reservation share the exclusion constraint", async () => {
  await fixture();
  const unit = await db.bookingUnit.create({ data: {
    businessId, placeId, name: `Party room ${run}`, timezone: "Europe/Minsk", stepMinutes: 15,
    rules: { create: { weekday: 2, startMinutes: 600, endMinutes: 720 } },
  } });
  unitIds.push(unit.id);
  const offerId = await resourceOffer(unit.id);
  const startAt = nextTuesday;
  const endAt = nextTuesdayEnd;
  const partyRequest = await db.bookingRequest.create({ data: {
    businessId, publicationType: "OFFER", offerId, kind: "PARTY", status: "CONFIRMED",
  } });
  await db.bookingAllocation.create({ data: {
    bookingUnitId: unit.id, bookingRequestId: partyRequest.id,
    blockStart: startAt, blockEnd: endAt, status: "CONFIRMED",
  } });
  await assert.rejects(
    reserveSlot({ offerId, startsAt: startAt, endsAt: endAt, unitId: unit.id, ...contact }),
    (error: unknown) => error instanceof SlotReservationError && error.code === "SLOT_UNAVAILABLE",
  );
});

test("two offers sharing one unit cannot reserve the same time concurrently", async () => {
  await fixture();
  const unit = await db.bookingUnit.create({ data: {
    businessId, placeId, name: `Shared room ${run}`, timezone: "Europe/Minsk", stepMinutes: 15,
    rules: { create: { weekday: 2, startMinutes: 600, endMinutes: 720 } },
  } });
  unitIds.push(unit.id);
  const [firstOfferId, secondOfferId] = await Promise.all([resourceOffer(unit.id), resourceOffer(unit.id)]);
  const startsAt = nextTuesday;
  const endsAt = nextTuesdayEnd;
  const results = await Promise.allSettled([
    reserveSlot({ offerId: firstOfferId, startsAt, endsAt, unitId: unit.id, ...contact }),
    reserveSlot({ offerId: secondOfferId, startsAt, endsAt, unitId: unit.id, ...contact }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof SlotReservationError);
  assert.equal(rejected.reason.code, "SLOT_UNAVAILABLE");
  assert.equal(await db.bookingAllocation.count({ where: { bookingUnitId: unit.id, status: "HELD" } }), 1);
});

test("camp projection preserves booked OfferSession identity across edits", async () => {
  await fixture();
  const offer = await db.offer.create({ data: {
    kind: "SERVICE", productType: "CAMP", title: `Camp ${run}`, placeId,
    status: "PUBLISHED", bookingEnabled: true, bookingMode: "USE_PUBLICATION_DATES",
    campPlacesCount: 8, offerBooking: { create: { scheduleKind: "SHIFTS" } },
  } });
  offerIds.push(offer.id);
  const shift = [{ dateFrom: "2030-07-01", dateTo: "2030-07-07" }];
  await projectCampSessions(db, offer.id, shift);
  const original = await db.offerSession.findFirstOrThrow({ where: { offerId: offer.id } });
  const snapshot = await loadSlotSnapshot({ offerId: offer.id, from: original.startAt, to: original.endAt });
  assert.equal(snapshot?.capacity, 8);
  await db.bookingRequest.create({ data: {
    businessId, publicationType: "OFFER", offerId: offer.id, offerSessionId: original.id,
    customerName: "Parent", customerPhone: contact.customerPhone,
  } });
  await projectCampSessions(db, offer.id, shift);
  const updated = await db.offerSession.findFirstOrThrow({ where: { offerId: offer.id } });
  assert.equal(updated.id, original.id);
  await projectCampSessions(db, offer.id, []);
  const cancelled = await db.offerSession.findUniqueOrThrow({ where: { id: original.id } });
  assert.equal(cancelled.isCancelled, true);
  assert.equal(await db.bookingRequest.count({ where: { offerSessionId: original.id } }), 1);
});
