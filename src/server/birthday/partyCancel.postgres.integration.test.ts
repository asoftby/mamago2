/**
 * Real PostgreSQL: a parent cancels a party before any confirmation (#818 D1).
 *
 * Only a disposable local database with the exact name/port below is allowed.
 *
 * DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/mamago_birthday_it \
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx \
 *   src/server/birthday/partyCancel.postgres.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PartyApiError } from "./partyDraft.validation";
import { cancelPartyBeforeConfirmation } from "./partyCancel.service";
import { replyToPartyRequest } from "./partyBusiness.service";
import { bookingBucket } from "@/server/services/booking/bookingBucket";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5434" ||
    url.pathname !== "/mamago_birthday_it") {
  throw new Error("Party integration only permits localhost:5434/mamago_birthday_it");
}

const db = new PrismaClient();
after(async () => db.$disconnect());
const eventDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(),
  new Date().getUTCDate() + 10));
const isPartyError = (status: number) => (error: unknown) =>
  error instanceof PartyApiError && error.status === status;

async function fixture() {
  const run = randomUUID().slice(0, 9);
  const country = await db.country.upsert({
    where: { slug: "belarus" }, update: { isActive: true, isoCode: "BY" },
    create: { name: "Belarus", slug: "belarus", isoCode: "BY", isActive: true },
  });
  const city = await db.city.upsert({
    where: { countryId_slug: { countryId: country.id, slug: "minsk" } },
    update: { isActive: true, isLegacyNonCity: false },
    create: { name: "Минск", slug: "minsk", countryId: country.id, isActive: true },
  });
  const owner = await db.user.create({ data: { email: `cancel-owner-${run}@example.test` } });
  const parent = await db.user.create({ data: { email: `cancel-parent-${run}@example.test` } });
  const stranger = await db.user.create({ data: { email: `cancel-stranger-${run}@example.test` } });
  const business = await db.business.create({
    data: { name: `Cancel business ${run}`, ownerUserId: owner.id, operationalStatus: "ACTIVE" },
  });
  const place = await db.place.create({
    data: {
      title: `Cancel hall ${run}`, shortDesc: "Disposable integration fixture",
      status: "PUBLISHED", cityId: city.id, ownerBusinessId: business.id,
      createdByUserId: owner.id, activityTypes: [], ageTags: [], visitFormats: [],
    },
  });
  const offer = (category: "VENUE" | "PHOTO") => db.offer.create({
    data: {
      title: `Cancel ${category} ${run}`, kind: "SERVICE", productType: "PARTY_SERVICE",
      category, placeId: place.id, status: "PUBLISHED",
      placements: { create: { key: "BIRTHDAY", status: "APPROVED" } },
    },
  });
  const venue = await offer("VENUE");
  const photo = await offer("PHOTO");

  /** Anchor at the given stage (with an active quote when QUOTED) plus a planned add-on. */
  async function party(anchorStage: "SENT" | "QUOTED" | "CONFIRMED") {
    const order = await db.partyOrder.create({
      data: {
        ownerUserId: parent.id, citySlug: "minsk", venueMode: "VENUE",
        status: anchorStage === "CONFIRMED" ? "ANCHOR_CONFIRMED" : "ANCHOR_PENDING",
        eventDate, timeFrom: "10:00", timeTo: "11:00", childrenCount: 8, adultsCount: 2,
      },
    });
    const anchor = await db.partyOrderItem.create({
      data: { partyOrderId: order.id, category: "VENUE", role: "ANCHOR", offerId: venue.id,
        businessId: business.id,
        status: anchorStage === "CONFIRMED" ? "CONFIRMED" : anchorStage === "QUOTED" ? "NEEDS_DECISION" : "REQUESTED" },
    });
    const addon = await db.partyOrderItem.create({
      data: { partyOrderId: order.id, category: "PHOTO", role: "STANDALONE", offerId: photo.id,
        businessId: business.id, status: "PLANNED", position: 1 },
    });
    const request = await db.bookingRequest.create({
      data: {
        businessId: business.id, userId: parent.id, publicationType: "OFFER", offerId: venue.id,
        kind: "PARTY", partyOrderItemId: anchor.id,
        status: anchorStage === "CONFIRMED" ? "CONFIRMED" : "NEW", partyStage: anchorStage,
        responseDueAt: anchorStage === "SENT" ? new Date(Date.now() + 3_600_000) : null,
        requestedDate: eventDate, requestedTime: "10:00", customerName: null, customerPhone: null,
      },
    });
    if (anchorStage === "CONFIRMED") {
      await db.partyOrderItem.update({ where: { id: anchor.id }, data: { confirmedBookingRequestId: request.id } });
    }
    const quote = anchorStage === "QUOTED" ? await db.partyQuote.create({
      data: { bookingRequestId: request.id, version: 1, type: "AS_REQUESTED", status: "ACTIVE",
        priceByn: 400, includes: "Room", idempotencyKey: randomUUID(), respondedByUserId: owner.id,
        validUntil: new Date(Date.now() + 3_600_000) },
    }) : null;
    return { order, anchor, addon, request, quote };
  }
  return { owner, parent, stranger, business, party };
}

test("a party without confirmations is cancelled at once and its requests are closed", async () => {
  const ctx = await fixture();
  const { order, anchor, addon, request, quote } = await ctx.party("QUOTED");

  await assert.rejects(cancelPartyBeforeConfirmation(ctx.stranger.id, order.id, order.version),
    isPartyError(404));
  await assert.rejects(cancelPartyBeforeConfirmation(ctx.parent.id, order.id, order.version + 1),
    isPartyError(409));

  const result = await cancelPartyBeforeConfirmation(ctx.parent.id, order.id, order.version);
  assert.deepEqual({ cancelled: result.cancelled, already: result.alreadyCancelled, closed: result.closedRequests },
    { cancelled: true, already: false, closed: 1 });

  const closed = await db.bookingRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.deepEqual({ stage: closed.partyStage, status: closed.status, reason: closed.partyCloseReason },
    { stage: "CANCELLED", status: "CANCELLED", reason: "CUSTOMER_CANCELLED" });
  // The business inbox must still classify the closed request (archive, no 500).
  assert.equal(bookingBucket({ kind: "PARTY", partyStage: closed.partyStage, status: closed.status,
    createdAt: closed.createdAt }).bucket, "ARCHIVE");
  assert.equal((await db.partyQuote.findUniqueOrThrow({ where: { id: quote!.id } })).status, "WITHDRAWN");
  for (const id of [anchor.id, addon.id]) {
    assert.equal((await db.partyOrderItem.findUniqueOrThrow({ where: { id } })).status, "CANCELLED");
  }
  const cancelled = await db.partyOrder.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(cancelled.status, "CANCELLED");
  assert.ok(cancelled.cancelledAt);

  // Repeat (lost response) is a no-op; the business can no longer answer the closed request.
  const again = await cancelPartyBeforeConfirmation(ctx.parent.id, order.id, order.version);
  assert.equal(again.alreadyCancelled, true);
  const sent = await ctx.party("SENT");
  await cancelPartyBeforeConfirmation(ctx.parent.id, sent.order.id, sent.order.version);
  await assert.rejects(replyToPartyRequest({
    businessId: ctx.business.id, actorUserId: ctx.owner.id, requestId: sent.request.id,
    idempotencyKey: randomUUID(),
    input: { type: "AS_REQUESTED", expectedStage: "SENT", expectedQuoteVersion: 0,
      priceByn: 400, includes: "Room" },
  }), isPartyError(409));
});

test("a party with a confirmed service is not cancelled by this action", async () => {
  const ctx = await fixture();
  const { order, request, addon } = await ctx.party("CONFIRMED");
  await assert.rejects(cancelPartyBeforeConfirmation(ctx.parent.id, order.id, order.version),
    isPartyError(409));
  assert.equal((await db.partyOrder.findUniqueOrThrow({ where: { id: order.id } })).status, "ANCHOR_CONFIRMED");
  assert.equal((await db.bookingRequest.findUniqueOrThrow({ where: { id: request.id } })).partyStage, "CONFIRMED");
  assert.equal((await db.partyOrderItem.findUniqueOrThrow({ where: { id: addon.id } })).status, "PLANNED");
});
