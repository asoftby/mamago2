/**
 * Explicitly opt-in local PostgreSQL integration test.
 * Never point this test at DEV/PROD or a shared database.
 * Run:
 * DATABASE_URL=postgresql://partytest@localhost:5434/mamago_birthday_it \
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx src/server/birthday/partyConfirmation.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { acceptPartyQuote, confirmPartyAnchor, listConfirmablePartyUnits } from "./partyConfirmation.service";
import { PartyApiError } from "./partyDraft.validation";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5434" || url.pathname !== "/mamago_birthday_it") {
  throw new Error("Only isolated localhost:5434/mamago_birthday_it is permitted");
}
const db = new PrismaClient();
after(async () => db.$disconnect());
const suffix = randomUUID().slice(0, 9);
const utcNow = new Date();
let daysUntilTuesday = (2 - utcNow.getUTCDay() + 7) % 7;
if (daysUntilTuesday < 3) daysUntilTuesday += 7;
const date = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate() + daysUntilTuesday));
const nowPlusHour = () => new Date(Date.now() + 3_600_000);
const nowPlusDay = () => new Date(Date.now() + 86_400_000);

async function setup() {
  const owner = await db.user.create({ data: { email: `party-owner-${suffix}@it.test` } });
  const parent = await db.user.create({ data: { email: `party-parent-${suffix}@it.test` } });
  const stranger = await db.user.create({ data: { email: `party-stranger-${suffix}@it.test` } });
  const business = await db.business.create({ data: {
    name: `Party IT ${suffix}`, ownerUserId: owner.id, operationalStatus: "ACTIVE",
  } });
  await db.businessMember.create({ data: {
    businessId: business.id, userId: owner.id, role: "OWNER", isActive: true,
  } });
  const place = await db.place.create({ data: {
    title: `Party Hall ${suffix}`, shortDesc: "Only isolated integration testing",
    ownerBusinessId: business.id, createdByUserId: owner.id,
    activityTypes: [], ageTags: [], visitFormats: [],
  } });
  const offer = await db.offer.create({ data: {
    title: `Party Package ${suffix}`, kind: "SERVICE",
    productType: "PARTY_SERVICE", category: "VENUE",
    placeId: place.id, status: "PUBLISHED", bookingEnabled: true,
    bookingMode: "USE_PUBLICATION_SLOTS",
    offerBooking: { create: {
      scheduleKind: "ON_REQUEST_WINDOWS", durationMin: 60,
      leadTimeHours: 0, horizonDays: 90,
    } },
  } });
  const unit = await db.bookingUnit.create({ data: {
    businessId: business.id, placeId: place.id, name: `Room ${suffix}`,
    timezone: "Europe/Minsk", stepMinutes: 30, prepMinutes: 0, cleanupMinutes: 0,
    rules: { create: { weekday: 2, startMinutes: 600, endMinutes: 720 } },
  } });
  await db.bookingUnitOffer.create({ data: { offerId: offer.id, bookingUnitId: unit.id } });
  const fixtureRequest = async () => {
    const order = await db.partyOrder.create({ data: {
      ownerUserId: parent.id, citySlug: "minsk", venueMode: "VENUE",
      status: "ANCHOR_PENDING", eventDate: date,
      timeFrom: "10:00", timeTo: "11:00", childrenCount: 8, adultsCount: 2,
      contactName: "Only Test Parent", contactPhone: "+375291112233",
    } });
    const item = await db.partyOrderItem.create({ data: {
      partyOrderId: order.id, category: "VENUE", role: "ANCHOR",
      offerId: offer.id, businessId: business.id, status: "NEEDS_DECISION",
    } });
    const request = await db.bookingRequest.create({ data: {
      businessId: business.id, userId: parent.id, publicationType: "OFFER",
      offerId: offer.id, kind: "PARTY", partyOrderItemId: item.id,
      status: "NEW", partyStage: "QUOTED", responseDueAt: nowPlusDay(),
      requestedDate: date, requestedTime: "10:00",
      customerName: null, customerPhone: null,
    } });
    const quote = await db.partyQuote.create({ data: {
      bookingRequestId: request.id, version: 1, status: "ACTIVE",
      type: "AS_REQUESTED", priceByn: 450, includes: "Room for 60 minutes",
      idempotencyKey: "quote-" + randomUUID(), respondedByUserId: owner.id,
      validUntil: nowPlusHour(),
    } });
    return { order, item, request, quote };
  };
  return { owner, parent, stranger, business, offer, unit, fixtureRequest };
}

async function expectPartyError(status: number, call: () => Promise<unknown>) {
  await assert.rejects(call, (error: unknown) =>
    error instanceof PartyApiError && error.status === status);
}

test("party quote acceptance and concurrent exclusive resource confirmation", async () => {
  const data = await setup();
  const [a, b] = await Promise.all([data.fixtureRequest(), data.fixtureRequest()]);
  await expectPartyError(404, () => acceptPartyQuote({
    ownerUserId: data.stranger.id, partyId: a.order.id, requestId: a.request.id,
    expectedQuoteVersion: 1, idempotencyKey: "intruder",
  }));
  await expectPartyError(409, () => acceptPartyQuote({
    ownerUserId: data.parent.id, partyId: a.order.id, requestId: a.request.id,
    expectedQuoteVersion: 3, idempotencyKey: "wrong-version",
  }));
  for (const row of [a, b]) {
    const first = await acceptPartyQuote({
      ownerUserId: data.parent.id, partyId: row.order.id,
      requestId: row.request.id, expectedQuoteVersion: 1,
      idempotencyKey: "accept-" + row.request.id,
    });
    assert.equal(first.status, "AWAITING_RECONFIRM");
    assert.equal(first.alreadyProcessed, false);
    const replay = await acceptPartyQuote({
      ownerUserId: data.parent.id, partyId: row.order.id,
      requestId: row.request.id, expectedQuoteVersion: 1,
      idempotencyKey: "accept-" + row.request.id,
    });
    assert.equal(replay.alreadyProcessed, true);
    const available = await listConfirmablePartyUnits({
      businessId: data.business.id, requestId: row.request.id,
    });
    assert.equal(available.quoteVersion, 1);
    assert.deepEqual(available.units.map(unit => unit.id), [data.unit.id]);
    assert.equal((await db.bookingRequest.findUniqueOrThrow({ where: { id: row.request.id } })).status, "NEW");
  }
  await expectPartyError(404, () => confirmPartyAnchor({
    businessId: "wrong-business", actorUserId: data.owner.id, requestId: a.request.id,
    expectedQuoteVersion: 1, bookingUnitId: data.unit.id, idempotencyKey: "wrong-business",
  }));
  await expectPartyError(409, () => confirmPartyAnchor({
    businessId: data.business.id, actorUserId: data.owner.id, requestId: a.request.id,
    expectedQuoteVersion: 2, bookingUnitId: data.unit.id, idempotencyKey: "wrong-version",
  }));

  const outcomes = await Promise.allSettled([a, b].map(row => confirmPartyAnchor({
    businessId: data.business.id, actorUserId: data.owner.id,
    requestId: row.request.id, expectedQuoteVersion: 1,
    bookingUnitId: data.unit.id, idempotencyKey: "confirm-" + row.request.id,
  })));
  const successes = outcomes.flatMap((outcome, index) =>
    outcome.status === "fulfilled" ? [{ result: outcome.value, row: [a, b][index]! }] : []);
  assert.equal(successes.length, 1, "exactly one party may occupy an exclusive resource");
  assert.equal(outcomes.filter(outcome => outcome.status === "rejected").length, 1);
  const winning = successes[0]!;
  assert.equal(winning.result.status, "CONFIRMED");
  assert.equal((await db.partyOrder.findUniqueOrThrow({ where: { id: winning.row.order.id } })).status, "ANCHOR_CONFIRMED");
  const replay = await confirmPartyAnchor({
    businessId: data.business.id, actorUserId: data.owner.id,
    requestId: winning.row.request.id, expectedQuoteVersion: 1,
    bookingUnitId: data.unit.id, idempotencyKey: "confirm-" + winning.row.request.id,
  });
  assert.equal(replay.alreadyProcessed, true);
  assert.equal(await db.bookingAllocation.count({
    where: { bookingUnitId: data.unit.id, status: "CONFIRMED" },
  }), 1);
  assert.equal(await db.partyOutbox.count({
    where: { eventType: "PARTY_BOOKING_CONFIRMED", aggregateId: winning.row.request.id },
  }), 1);
  assert.equal((await db.partyQuote.findUniqueOrThrow({
    where: { id: winning.row.quote.id },
  })).status, "ACCEPTED");
  const confirmed = await db.bookingRequest.findUniqueOrThrow({ where: { id: winning.row.request.id } });
  assert.equal(confirmed.customerName, "Only Test Parent");
  assert.equal(confirmed.customerPhone, "+375291112233");
  console.log("partyConfirmation.integration.test.ts: OK");
});
