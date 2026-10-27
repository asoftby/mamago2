/**
 * Real PostgreSQL booking confirmation integration.
 *
 * Only a disposable local database with the exact name/port below is allowed.
 * Never point this test at DEV or PROD databases.
 *
 * DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/mamago_birthday_it \
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx \
 *   src/server/birthday/partyConfirmation.postgres.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { acceptPartyQuote } from "./partyQuoteAcceptance.service";
import { confirmPartyRequest } from "./partyConfirm.service";
import { listPartyConfirmChoices } from "./partyConfirmChoices.service";
import { replyToPartyRequest } from "./partyBusiness.service";
import { requestPartyAddonsAfterAnchor } from "./partyAddonFanout";
import { PartyApiError } from "./partyDraft.validation";

const databaseUrl = process.env.DATABASE_URL;
let url: URL;
try {
  url = new URL(databaseUrl ?? "");
} catch {
  throw new Error("Use a disposable localhost:5434/mamago_birthday_it database");
}
if (
  url.protocol !== "postgresql:" &&
  url.protocol !== "postgres:"
) {
  throw new Error("Party integration requires PostgreSQL");
}
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "5434" ||
  url.pathname !== "/mamago_birthday_it"
) {
  throw new Error("Party integration only permits localhost:5434/mamago_birthday_it");
}

const db = new PrismaClient();
after(async () => db.$disconnect());

const suffix = randomUUID().slice(0, 9);
const eventDate = (() => {
  const today = new Date();
  let untilTuesday = (2 - today.getUTCDay() + 7) % 7;
  if (untilTuesday < 3) untilTuesday += 7;
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + untilTuesday));
})();
const oneHourLater = () => new Date(Date.now() + 60 * 60_000);
const oneDayLater = () => new Date(Date.now() + 24 * 60 * 60_000);

async function fixture() {
  // Each test gets its own users and business; emails are unique.
  const run = suffix + "-" + randomUUID().slice(0, 4);
  // Fresh migrations may already seed Belarus and Minsk; reuse them in
  // this disposable database instead of failing on unique country/city slugs.
  const country = await db.country.upsert({
    where: { slug: "belarus" },
    update: { isActive: true, isoCode: "BY" },
    create: { name: "Belarus", slug: "belarus", isoCode: "BY", isActive: true },
  });
  const city = await db.city.upsert({
    where: { countryId_slug: { countryId: country.id, slug: "minsk" } },
    update: { isActive: true, isLegacyNonCity: false },
    create: { name: "Минск", slug: "minsk", countryId: country.id, isActive: true },
  });
  const owner = await db.user.create({ data: { email: `party-owner-${run}@example.test` } });
  const parent = await db.user.create({ data: { email: `party-parent-${run}@example.test` } });
  const outsider = await db.user.create({ data: { email: `party-outsider-${run}@example.test` } });
  const business = await db.business.create({
    data: { name: `Party business ${run}`, ownerUserId: owner.id, operationalStatus: "ACTIVE" },
  });
  await db.businessMember.create({
    data: { businessId: business.id, userId: owner.id, role: "OWNER", isActive: true },
  });
  const place = await db.place.create({
    data: {
      title: `Party hall ${run}`, shortDesc: "Disposable integration fixture",
      status: "PUBLISHED", cityId: city.id, ownerBusinessId: business.id,
      createdByUserId: owner.id, activityTypes: [], ageTags: [], visitFormats: [],
    },
  });
  const offer = await db.offer.create({
    data: {
      title: `Party venue ${run}`, kind: "SERVICE", productType: "PARTY_SERVICE",
      category: "VENUE", placeId: place.id, status: "PUBLISHED",
      bookingEnabled: true, bookingMode: "USE_PUBLICATION_SLOTS",
      placements: { create: { key: "BIRTHDAY", status: "APPROVED" } },
      offerBooking: { create: {
        scheduleKind: "ON_REQUEST_WINDOWS", durationMin: 60,
        leadTimeHours: 0, horizonDays: 90,
      } },
    },
  });
  const unit = await db.bookingUnit.create({
    data: {
      businessId: business.id, placeId: place.id, name: `Party room ${run}`,
      timezone: "Europe/Minsk", stepMinutes: 30,
      rules: { create: { weekday: 2, startMinutes: 600, endMinutes: 720 } },
    },
  });
  await db.bookingUnitOffer.create({
    data: { offerId: offer.id, bookingUnitId: unit.id },
  });

  async function requestWithQuote() {
    const order = await db.partyOrder.create({
      data: {
        ownerUserId: parent.id, citySlug: "minsk", venueMode: "VENUE",
        status: "ANCHOR_PENDING", eventDate, timeFrom: "10:00", timeTo: "11:00",
        childrenCount: 8, adultsCount: 2,
        contactName: "Test Parent", contactPhone: "+375291112233",
      },
    });
    const item = await db.partyOrderItem.create({
      data: {
        partyOrderId: order.id, category: "VENUE", role: "ANCHOR",
        offerId: offer.id, businessId: business.id, status: "REQUESTED",
      },
    });
    const request = await db.bookingRequest.create({
      data: {
        businessId: business.id, userId: parent.id, publicationType: "OFFER",
        offerId: offer.id, kind: "PARTY", partyOrderItemId: item.id,
        status: "NEW", partyStage: "QUOTED", responseDueAt: oneDayLater(),
        requestedDate: eventDate, requestedTime: "10:00",
        customerName: null, customerPhone: null,
      },
    });
    const quote = await db.partyQuote.create({
      data: {
        bookingRequestId: request.id, version: 1, type: "AS_REQUESTED",
        status: "ACTIVE", priceByn: 450, includes: "Room for one hour",
        idempotencyKey: `quote-${randomUUID()}`, respondedByUserId: owner.id,
        validUntil: oneHourLater(),
      },
    });
    return { order, item, request, quote };
  }
  return { owner, parent, outsider, business, place, unit, requestWithQuote };
}

function isPartyError(status: number) {
  return (error: unknown) => error instanceof PartyApiError && error.status === status;
}

test("quote acceptance and concurrent room confirmation are exclusive and idempotent", async () => {
  const ctx = await fixture();
  const [first, second] = await Promise.all([ctx.requestWithQuote(), ctx.requestWithQuote()]);

  await assert.rejects(
    acceptPartyQuote({
      userId: ctx.outsider.id, orderId: first.order.id,
      requestId: first.request.id, quoteId: first.quote.id, expectedVersion: 1,
    }),
    isPartyError(404),
  );
  await assert.rejects(
    acceptPartyQuote({
      userId: ctx.parent.id, orderId: first.order.id,
      requestId: first.request.id, quoteId: first.quote.id, expectedVersion: 2,
    }),
    isPartyError(409),
  );

  for (const entry of [first, second]) {
    const input = {
      userId: ctx.parent.id, orderId: entry.order.id,
      requestId: entry.request.id, quoteId: entry.quote.id, expectedVersion: 1,
    };
    const accepted = await acceptPartyQuote(input);
    assert.equal(accepted.awaitingBusinessConfirmation, true);
    assert.equal(accepted.alreadyAccepted, false);
    assert.equal((await acceptPartyQuote(input)).alreadyAccepted, true);
    const preview = await listPartyConfirmChoices(ctx.business.id, entry.request.id);
    assert.equal(preview.quoteVersion, 1);
    assert.deepEqual(preview.units.map((unit) => unit.id), [ctx.unit.id]);
    assert.equal((await db.bookingRequest.findUniqueOrThrow({
      where: { id: entry.request.id },
    })).status, "NEW", "accepting a quote must not confirm a booking");
  }

  const confirm = (requestId: string, key: string, businessId = ctx.business.id, version = 1) =>
    confirmPartyRequest({
      requestId, businessId, actorUserId: ctx.owner.id,
      expectedQuoteVersion: version, bookingUnitId: ctx.unit.id,
      idempotencyKey: key,
    });
  await assert.rejects(confirm(first.request.id, "wrong-business", "other-business"), isPartyError(404));
  await assert.rejects(confirm(first.request.id, "wrong-version", ctx.business.id, 2), isPartyError(409));

  const results = await Promise.allSettled([
    confirm(first.request.id, "first-confirm"),
    confirm(second.request.id, "second-confirm"),
  ]);
  const success = results.flatMap((result, index) =>
    result.status === "fulfilled" ? [{ result: result.value, entry: [first, second][index] }] : []);
  assert.equal(success.length, 1, "only one party can confirm the exclusive room");
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const loser = results.find((result) => result.status === "rejected");
  assert.ok(loser && loser.status === "rejected");
  assert.ok(isPartyError(409)(loser.reason), "the other request must receive a conflict");

  const winner = success[0]!;
  assert.equal(winner.result.confirmed, true);
  assert.equal(winner.result.alreadyConfirmed, false);
  assert.equal((await db.partyOrder.findUniqueOrThrow({
    where: { id: winner.entry.order.id },
  })).status, "ANCHOR_CONFIRMED");
  assert.equal((await confirm(winner.entry.request.id,
    winner.entry === first ? "first-confirm" : "second-confirm")).alreadyConfirmed, true);
  assert.equal(await db.bookingAllocation.count({
    where: { bookingUnitId: ctx.unit.id, status: "CONFIRMED" },
  }), 1);
  assert.equal(await db.partyOutbox.count({
    where: { eventType: "PARTY_BOOKING_CONFIRMED", aggregateId: winner.entry.request.id },
  }), 1);
  assert.equal((await db.partyQuote.findUniqueOrThrow({
    where: { id: winner.entry.quote.id },
  })).status, "ACCEPTED");
  assert.equal((await db.bookingRequest.findUniqueOrThrow({
    where: { id: winner.entry.request.id },
  })).status, "CONFIRMED");
});

type Ctx = Awaited<ReturnType<typeof fixture>>;

/** A home party performer: an exclusive BookingUnit working 09:00–20:00 on the party weekday. */
async function homeSetup(ctx: Ctx, opts: { withUnit?: boolean; cleanupMinutes?: number } = {}) {
  const tag = randomUUID().slice(0, 6);
  const partyOffer = (title: string, category: "ANIMATOR" | "PHOTO", priceFrom: number) =>
    db.offer.create({
      data: {
        title: `${title} ${tag}`, kind: "SERVICE", productType: "PARTY_SERVICE",
        category, placeId: ctx.place.id, status: "PUBLISHED",
        priceFrom, priceMode: "FROM", currency: "BYN",
        placements: { create: { key: "BIRTHDAY", status: "APPROVED" } },
      },
    });
  const animator = await partyOffer("Animator", "ANIMATOR", 180);
  const photo = await partyOffer("Photographer", "PHOTO", 120);
  const performer = opts.withUnit === false ? null : await db.bookingUnit.create({
    data: {
      businessId: ctx.business.id, name: `Animator Vasya ${tag}`, timezone: "Europe/Minsk",
      cleanupMinutes: opts.cleanupMinutes ?? 0,
      rules: { create: { weekday: eventDate.getUTCDay() || 7, startMinutes: 540, endMinutes: 1200 } },
      offers: { create: { offerId: animator.id } },
    },
  });
  return { animator, photo, performer };
}

async function homeOrder(ctx: Ctx, offers: { animator: { id: string }; photo?: { id: string } },
  timeFrom: string, timeTo: string) {
  const order = await db.partyOrder.create({
    data: {
      ownerUserId: ctx.parent.id, citySlug: "minsk", venueMode: "HOME",
      status: "ANCHOR_PENDING", eventDate, timeFrom, timeTo,
      childrenCount: 8, adultsCount: 2, childAge: 6,
      contactName: "Test Parent", contactPhone: "+375291112233",
    },
  });
  const anchor = await db.partyOrderItem.create({
    data: {
      partyOrderId: order.id, category: "ANIMATOR", role: "ANCHOR", offerId: offers.animator.id,
      businessId: ctx.business.id, status: "REQUESTED", offerPriceSnapshot: 180, position: 0,
    },
  });
  const addon = offers.photo ? await db.partyOrderItem.create({
    data: {
      partyOrderId: order.id, category: "PHOTO", role: "STANDALONE", offerId: offers.photo.id,
      businessId: ctx.business.id, status: "PLANNED", offerPriceSnapshot: 120, position: 1,
    },
  }) : null;
  const request = await db.bookingRequest.create({
    data: {
      businessId: ctx.business.id, userId: ctx.parent.id, publicationType: "OFFER",
      offerId: offers.animator.id, kind: "PARTY", partyOrderItemId: anchor.id,
      status: "NEW", partyStage: "SENT", responseDueAt: oneDayLater(),
      requestedDate: eventDate, requestedTime: timeFrom,
      customerName: null, customerPhone: null,
    },
  });
  return { order, anchor, addon, request };
}

function fixedPriceReply(ctx: Ctx, requestId: string, durationMinutes: number, key: string = randomUUID()) {
  return replyToPartyRequest({
    businessId: ctx.business.id, actorUserId: ctx.owner.id, requestId, idempotencyKey: key,
    input: { type: "AS_REQUESTED", expectedStage: "SENT", expectedQuoteVersion: 0,
      priceByn: 180, includes: "Programme", durationMinutes },
  });
}

test("fixed-price auto-confirmation at home requests each add-on exactly once", async () => {
  const ctx = await fixture();
  const setup = await homeSetup(ctx);
  const { order, addon, request } = await homeOrder(ctx, setup, "10:00", "11:00");
  const key = `auto-${suffix}`;
  const first = await fixedPriceReply(ctx, request.id, 60, key);
  assert.equal(first.alreadyResponded, false);
  assert.equal(first.quote.status, "ACCEPTED");
  assert.equal((await db.partyOrder.findUniqueOrThrow({ where: { id: order.id } })).status,
    "ANCHOR_CONFIRMED");

  const addonRequests = () => db.bookingRequest.findMany({
    where: { partyOrderItemId: addon!.id },
    select: { id: true, partyStage: true, status: true, childrenCount: true, childAge: true },
  });
  const sent = await addonRequests();
  assert.equal(sent.length, 1, "the add-on gets one request after the anchor auto-confirms");
  assert.deepEqual(
    { stage: sent[0].partyStage, status: sent[0].status, children: sent[0].childrenCount, age: sent[0].childAge },
    { stage: "SENT", status: "NEW", children: 8, age: 6 },
  );
  assert.equal((await db.partyOrderItem.findUniqueOrThrow({ where: { id: addon!.id } })).status, "REQUESTED");
  assert.equal(await db.partyOutbox.count({
    where: { eventType: "PARTY_REQUEST_SENT", aggregateId: sent[0].id },
  }), 1);

  // A replayed reply (lost response) and a repeated fan-out must not request the add-on again.
  const replay = await fixedPriceReply(ctx, request.id, 60, key);
  assert.equal(replay.alreadyResponded, true);
  const repeated = await db.$transaction((tx) => requestPartyAddonsAfterAnchor(tx, {
    order: { ...order, eventDate, timeFrom: "10:00" }, anchorRequestId: request.id, now: new Date(),
  }));
  assert.equal(repeated, 0);
  assert.equal((await addonRequests()).length, 1);
});

test("one performer cannot be auto-confirmed for two overlapping parties", async () => {
  const ctx = await fixture();
  const setup = await homeSetup(ctx, { cleanupMinutes: 30 });
  const [a, b] = await Promise.all([
    homeOrder(ctx, setup, "10:00", "11:00"),
    homeOrder(ctx, setup, "10:30", "11:30"),
  ]);
  const results = await Promise.allSettled([
    fixedPriceReply(ctx, a.request.id, 60), fixedPriceReply(ctx, b.request.id, 60),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1,
    "exactly one concurrent auto-confirmation wins the performer");
  const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  assert.ok(isPartyError(409)(rejected.reason), String(rejected.reason));
  const allocations = await db.bookingAllocation.findMany({
    where: { bookingUnitId: setup.performer!.id, status: "CONFIRMED" },
    select: { bookingRequestId: true },
  });
  assert.equal(allocations.length, 1);
  const loser = results[0].status === "rejected" ? a : b;
  const loserRequest = await db.bookingRequest.findUniqueOrThrow({ where: { id: loser.request.id } });
  assert.equal(loserRequest.partyStage, "SENT", "the losing reply is rolled back, not half-applied");
  assert.equal(await db.partyQuote.count({ where: { bookingRequestId: loser.request.id } }), 0);

  // Cleanup (30 min) widens the 10:00–11:00 booking to 11:30: 11:15 overlaps, 11:30 does not.
  const winner = results[0].status === "fulfilled" ? a : b;
  const winnerEnd = winner === a ? "11:00" : "11:30";
  const tooEarly = await homeOrder(ctx, setup, addMinutes(winnerEnd, 15), addMinutes(winnerEnd, 75));
  await assert.rejects(fixedPriceReply(ctx, tooEarly.request.id, 60), isPartyError(409));
  const afterCleanup = await homeOrder(ctx, setup, addMinutes(winnerEnd, 30), addMinutes(winnerEnd, 90));
  assert.equal((await fixedPriceReply(ctx, afterCleanup.request.id, 60)).quote.status, "ACCEPTED");
});

test("manual confirmation cannot take a performer already booked by an auto-confirmation", async () => {
  const ctx = await fixture();
  const setup = await homeSetup(ctx);
  const booked = await homeOrder(ctx, setup, "12:00", "13:00");
  await fixedPriceReply(ctx, booked.request.id, 60);

  const other = await homeOrder(ctx, setup, "12:30", "13:30");
  // A modified price is not auto-confirmed: the parent accepts, then the business confirms.
  const quoted = await replyToPartyRequest({
    businessId: ctx.business.id, actorUserId: ctx.owner.id, requestId: other.request.id,
    idempotencyKey: randomUUID(),
    input: { type: "MODIFIED", expectedStage: "SENT", expectedQuoteVersion: 0,
      priceByn: 200, includes: "Programme", changeReason: "Другая программа", durationMinutes: 60 },
  });
  assert.equal(quoted.quote.status, "ACTIVE");
  await acceptPartyQuote({ userId: ctx.parent.id, orderId: other.order.id,
    requestId: other.request.id, quoteId: quoted.quote.id, expectedVersion: quoted.quote.version });
  await assert.rejects(confirmPartyRequest({
    requestId: other.request.id, businessId: ctx.business.id, actorUserId: ctx.owner.id,
    expectedQuoteVersion: quoted.quote.version, idempotencyKey: randomUUID(),
    bookingUnitId: setup.performer!.id,
  }), isPartyError(409));
});

test("without a performer resource the reply waits for a manual confirmation", async () => {
  const ctx = await fixture();
  const setup = await homeSetup(ctx, { withUnit: false });
  const { order, request } = await homeOrder(ctx, setup, "15:00", "16:00");
  const reply = await fixedPriceReply(ctx, request.id, 60);
  assert.equal(reply.quote.status, "ACTIVE", "no auto-confirmation without an occupancy check");
  assert.equal((await db.bookingRequest.findUniqueOrThrow({ where: { id: request.id } })).partyStage, "QUOTED");
  assert.equal((await db.partyOrder.findUniqueOrThrow({ where: { id: order.id } })).status, "ANCHOR_PENDING");
});

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

test("with PARTY_CONFIRMATION_ENABLED off nothing is accepted or confirmed", async () => {
  const ctx = await fixture();
  const previous = process.env.PARTY_CONFIRMATION_ENABLED;
  process.env.PARTY_CONFIRMATION_ENABLED = "false";
  try {
    const venue = await ctx.requestWithQuote();
    await assert.rejects(acceptPartyQuote({
      userId: ctx.parent.id, orderId: venue.order.id, requestId: venue.request.id,
      quoteId: venue.quote.id, expectedVersion: 1,
    }), isPartyError(503));
    await assert.rejects(confirmPartyRequest({
      requestId: venue.request.id, businessId: ctx.business.id, actorUserId: ctx.owner.id,
      expectedQuoteVersion: 1, idempotencyKey: randomUUID(), bookingUnitId: ctx.unit.id,
    }), isPartyError(503));
    assert.equal((await db.partyQuote.findUniqueOrThrow({ where: { id: venue.quote.id } })).status, "ACTIVE");

    // A fixed-price reply is still recorded, but as an offer, not an automatic confirmation.
    const setup = await homeSetup(ctx);
    const home = await homeOrder(ctx, setup, "16:00", "17:00");
    const reply = await fixedPriceReply(ctx, home.request.id, 60);
    assert.equal(reply.quote.status, "ACTIVE");
    assert.equal((await db.partyOrder.findUniqueOrThrow({ where: { id: home.order.id } })).status, "ANCHOR_PENDING");
    assert.equal(await db.bookingAllocation.count({ where: { bookingUnitId: setup.performer!.id } }), 0);
  } finally {
    if (previous === undefined) delete process.env.PARTY_CONFIRMATION_ENABLED;
    else process.env.PARTY_CONFIRMATION_ENABLED = previous;
  }
});
