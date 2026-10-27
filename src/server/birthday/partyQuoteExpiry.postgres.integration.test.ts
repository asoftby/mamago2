/**
 * Real PostgreSQL: offers not accepted in time are closed by the server.
 *
 * Only a disposable local database with the exact name/port below is allowed.
 *
 * DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/mamago_birthday_it \
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx \
 *   src/server/birthday/partyQuoteExpiry.postgres.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PartyApiError } from "./partyDraft.validation";
import { expirePartyRequests } from "./partyRequestExpiry.service";
import { resolveExpiredPartyQuote } from "./partyQuoteResolution.service";
import { bookingBucket } from "@/server/services/booking/bookingBucket";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5434" ||
    url.pathname !== "/mamago_birthday_it") {
  throw new Error("Party integration only permits localhost:5434/mamago_birthday_it");
}

const db = new PrismaClient();
after(async () => db.$disconnect());
const run = randomUUID().slice(0, 9);
const eventDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(),
  new Date().getUTCDate() + 10));

async function fixture() {
  const country = await db.country.upsert({
    where: { slug: "belarus" }, update: { isActive: true, isoCode: "BY" },
    create: { name: "Belarus", slug: "belarus", isoCode: "BY", isActive: true },
  });
  await db.city.upsert({
    where: { countryId_slug: { countryId: country.id, slug: "minsk" } },
    update: { isActive: true, isLegacyNonCity: false },
    create: { name: "Минск", slug: "minsk", countryId: country.id, isActive: true },
  });
  const owner = await db.user.create({ data: { email: `expiry-owner-${run}@example.test` } });
  const parent = await db.user.create({ data: { email: `expiry-parent-${run}@example.test` } });
  const business = await db.business.create({
    data: { name: `Expiry business ${run}`, ownerUserId: owner.id, operationalStatus: "ACTIVE" },
  });
  const city = await db.city.findFirstOrThrow({ where: { slug: "minsk" } });
  const place = await db.place.create({
    data: {
      title: `Expiry hall ${run}`, shortDesc: "Disposable integration fixture",
      status: "PUBLISHED", cityId: city.id, ownerBusinessId: business.id,
      createdByUserId: owner.id, activityTypes: [], ageTags: [], visitFormats: [],
    },
  });
  const offer = await db.offer.create({
    data: {
      title: `Expiry venue ${run}`, kind: "SERVICE", productType: "PARTY_SERVICE",
      category: "VENUE", placeId: place.id, status: "PUBLISHED",
      placements: { create: { key: "BIRTHDAY", status: "APPROVED" } },
    },
  });

  async function quotedRequest(validUntil: Date) {
    const order = await db.partyOrder.create({
      data: {
        ownerUserId: parent.id, citySlug: "minsk", venueMode: "VENUE",
        status: "ANCHOR_PENDING", eventDate, timeFrom: "10:00", timeTo: "11:00",
        childrenCount: 8, adultsCount: 2,
      },
    });
    const item = await db.partyOrderItem.create({
      data: { partyOrderId: order.id, category: "VENUE", role: "ANCHOR",
        offerId: offer.id, businessId: business.id, status: "NEEDS_DECISION" },
    });
    const request = await db.bookingRequest.create({
      data: {
        businessId: business.id, userId: parent.id, publicationType: "OFFER",
        offerId: offer.id, kind: "PARTY", partyOrderItemId: item.id,
        status: "NEW", partyStage: "QUOTED", responseDueAt: null,
        requestedDate: eventDate, requestedTime: "10:00",
        customerName: null, customerPhone: null,
      },
    });
    const quote = await db.partyQuote.create({
      data: {
        bookingRequestId: request.id, version: 1, type: "AS_REQUESTED", status: "ACTIVE",
        priceByn: 450, includes: "Room for one hour", idempotencyKey: randomUUID(),
        respondedByUserId: owner.id, validUntil,
      },
    });
    return { order, item, request, quote };
  }
  return { owner, business, quotedRequest };
}

test("an offer not accepted in time is closed by the server and both sides are notified", async () => {
  const ctx = await fixture();
  const stale = await ctx.quotedRequest(new Date(Date.now() - 60_000));
  const fresh = await ctx.quotedRequest(new Date(Date.now() + 3_600_000));

  await expirePartyRequests();

  const request = await db.bookingRequest.findUniqueOrThrow({ where: { id: stale.request.id } });
  assert.deepEqual(
    { stage: request.partyStage, status: request.status, reason: request.partyCloseReason },
    { stage: "NOT_ACCEPTED", status: "CANCELLED", reason: "EXPIRED" },
  );
  // The business inbox classifies every request; the closed one must land in the archive
  // (an unsupported stage/status pair would make the whole inbox fail).
  assert.equal(bookingBucket({ kind: "PARTY", partyStage: request.partyStage, status: request.status,
    responseDueAt: request.responseDueAt, createdAt: request.createdAt }).bucket, "ARCHIVE");
  assert.equal((await db.partyQuote.findUniqueOrThrow({ where: { id: stale.quote.id } })).status, "EXPIRED");
  assert.equal((await db.partyOrderItem.findUniqueOrThrow({ where: { id: stale.item.id } })).status, "EXPIRED");
  assert.equal((await db.partyOrder.findUniqueOrThrow({ where: { id: stale.order.id } })).status,
    "NEEDS_ALTERNATIVE");
  const events = await db.partyOutbox.findMany({
    where: { aggregateId: stale.request.id }, select: { eventType: true },
  });
  assert.deepEqual(events.map((e) => e.eventType).sort(),
    ["PARTY_QUOTE_EXPIRED", "PARTY_QUOTE_EXPIRED_BUSINESS"]);

  // A still valid offer is untouched, a second run changes nothing, and the business can
  // no longer extend the closed offer.
  assert.equal((await db.bookingRequest.findUniqueOrThrow({ where: { id: fresh.request.id } })).partyStage,
    "QUOTED");
  assert.equal((await db.partyQuote.findUniqueOrThrow({ where: { id: fresh.quote.id } })).status, "ACTIVE");
  await expirePartyRequests();
  assert.equal(await db.partyOutbox.count({ where: { aggregateId: stale.request.id } }), 2);
  await assert.rejects(resolveExpiredPartyQuote({
    businessId: ctx.business.id, requestId: stale.request.id, actorUserId: ctx.owner.id,
    key: randomUUID(), resolution: { action: "EXTEND", expectedQuoteVersion: 1,
      validUntil: new Date(Date.now() + 2 * 3_600_000) },
  }), (error: unknown) => error instanceof PartyApiError && error.status === 409);
});
