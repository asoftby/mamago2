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
  const owner = await db.user.create({ data: { email: `party-owner-${suffix}@example.test` } });
  const parent = await db.user.create({ data: { email: `party-parent-${suffix}@example.test` } });
  const outsider = await db.user.create({ data: { email: `party-outsider-${suffix}@example.test` } });
  const business = await db.business.create({
    data: { name: `Party business ${suffix}`, ownerUserId: owner.id, operationalStatus: "ACTIVE" },
  });
  await db.businessMember.create({
    data: { businessId: business.id, userId: owner.id, role: "OWNER", isActive: true },
  });
  const place = await db.place.create({
    data: {
      title: `Party hall ${suffix}`, shortDesc: "Disposable integration fixture",
      status: "PUBLISHED", cityId: city.id, ownerBusinessId: business.id,
      createdByUserId: owner.id, activityTypes: [], ageTags: [], visitFormats: [],
    },
  });
  const offer = await db.offer.create({
    data: {
      title: `Party venue ${suffix}`, kind: "SERVICE", productType: "PARTY_SERVICE",
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
      businessId: business.id, placeId: place.id, name: `Party room ${suffix}`,
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
  return { owner, parent, outsider, business, unit, requestWithQuote };
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
