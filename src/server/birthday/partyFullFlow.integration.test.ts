import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { createPartyDraft, updatePartyDraft } from "./partyDraft.service";
import { submitPartyAnchor } from "./partySubmit.service";
import { replyToPartyRequest } from "./partyBusiness.service";
import { acceptPartyQuote } from "./partyQuoteAcceptance.service";
import { confirmPartyRequest } from "./partyConfirm.service";
import { listPartyConfirmChoices } from "./partyConfirmChoices.service";
import { PartyApiError } from "./partyDraft.validation";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55443" ||
    url.pathname !== "/mamago_birthday_it") {
  throw new Error("SAFE ABORT: not the isolated birthday IT cluster");
}

const key = Math.random().toString(36).slice(2, 12);
const date = new Date(Date.now() + 12 * 86_400_000).toISOString().slice(0, 10);
const utcDate = new Date(date + "T00:00:00Z");
const day = utcDate.getUTCDay() || 7;

async function expectPartyError(status: number, run: () => Promise<unknown>, label: string) {
  try { await run(); } catch (cause) {
    assert.ok(cause instanceof PartyApiError, label + ": " + String(cause));
    assert.equal(cause.status, status, label);
    console.log("PASS expected " + status + ": " + label);
    return;
  }
  assert.fail(label + ": operation unexpectedly succeeded");
}

async function main() {
  const parent = await prisma.user.findUniqueOrThrow({ where: { email: "parent@it.test" } });
  const bizA = await prisma.business.findFirstOrThrow({ where: { owner: { email: "owner-a@it.test" } } });
  const bizB = await prisma.business.findFirstOrThrow({ where: { owner: { email: "owner-b@it.test" } } });
  const ownerA = await prisma.user.findUniqueOrThrow({ where: { email: "owner-a@it.test" } });
  const ownerB = await prisma.user.findUniqueOrThrow({ where: { email: "owner-b@it.test" } });
  const seedOffer = await prisma.offer.findUniqueOrThrow({ where: { id: "it-offer-venue" } });
  // An isolated per-run offer keeps old test allocations/disabled resources
  // from influencing subsequent runs on the same local test cluster.
  const anchorOffer = await prisma.offer.create({
    data: {
      id: "it-offer-venue-" + key, placeId: seedOffer.placeId,
      kind: "SERVICE", productType: "PARTY_SERVICE", category: "VENUE",
      title: "IT venue " + key, status: "PUBLISHED", publishedAt: new Date(),
      priceFrom: 350, priceMode: "FROM", currency: "BYN",
    },
  });
  await prisma.offerPlacement.create({
    data: { offerId: anchorOffer.id, key: "BIRTHDAY", status: "APPROVED" },
  });

  const createUnit = async (label: string) => {
    const unit = await prisma.bookingUnit.create({
      data: { businessId: bizA.id, name: "IT Room " + label + "-" + key,
        timezone: "Europe/Minsk", capacity: 15, prepMinutes: 20, cleanupMinutes: 15,
        rules: { create: [{ weekday: day, startMinutes: 540, endMinutes: 1200 }] },
      },
    });
    await prisma.bookingUnitOffer.create({ data: { offerId: anchorOffer.id, bookingUnitId: unit.id } });
    return unit;
  };

  const createRequest = async (label: string, includeAddon = false) => {
    const draft = await createPartyDraft(parent.id, { citySlug: "minsk", venueMode: "VENUE" });
    const chosen = await updatePartyDraft(parent.id, draft.id, { version: draft.version,
      anchorOfferId: anchorOffer.id, addonOfferIds: includeAddon ? ["it-offer-photo"] : [] });
    const ready = await updatePartyDraft(parent.id, draft.id, { version: chosen.version,
      childName: "IT Child " + label, eventDate: date, timeFrom: "12:00", timeTo: "15:00",
      childrenCount: 8, adultsCount: 4, contactName: "IT Parent",
      contactPhone: "+375291112233" });
    const sent = await submitPartyAnchor(parent.id, draft.id, ready.version, "sub_" + key + "_" + label);
    const proposal = await replyToPartyRequest({
      businessId: bizA.id, actorUserId: ownerA.id, requestId: sent.request.id,
      idempotencyKey: "reply_" + key + "_" + label,
      input: { expectedStage: "SENT", expectedQuoteVersion: 0,
        type: "AS_REQUESTED", priceByn: 350, includes: "Комната на 3 часа" },
    });
    return { draftId: draft.id, requestId: sent.request.id,
      quoteId: proposal.quote.id, version: proposal.quote.version };
  };

  const firstUnit = await createUnit("primary");
  const a = await createRequest("A", true);
  await expectPartyError(404, () => acceptPartyQuote({
    userId: ownerA.id, orderId: a.draftId, requestId: a.requestId,
    quoteId: a.quoteId, expectedVersion: a.version,
  }), "not the parent");
  const accepted = await acceptPartyQuote({
    userId: parent.id, orderId: a.draftId, requestId: a.requestId,
    quoteId: a.quoteId, expectedVersion: a.version,
  });
  assert.equal(accepted.awaitingBusinessConfirmation, true);
  assert.equal(accepted.alreadyAccepted, false);
  const replayAccept = await acceptPartyQuote({
    userId: parent.id, orderId: a.draftId, requestId: a.requestId,
    quoteId: a.quoteId, expectedVersion: a.version,
  });
  assert.equal(replayAccept.alreadyAccepted, true);
  console.log("PASS parent accepts versioned quote, idempotent replay");

  await expectPartyError(404, () => confirmPartyRequest({
    requestId: a.requestId, businessId: bizB.id, actorUserId: ownerA.id,
    expectedQuoteVersion: a.version, idempotencyKey: "confirm_bad",
    bookingUnitId: firstUnit.id,
  }), "wrong business denied");
  await expectPartyError(409, () => confirmPartyRequest({
    requestId: a.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: a.version + 1, idempotencyKey: "stale",
    bookingUnitId: firstUnit.id,
  }), "wrong quote version");

  const choices = await listPartyConfirmChoices(bizA.id, a.requestId);
  assert.equal(choices.quoteVersion, a.version);
  assert.ok(choices.units.some((u) => u.id === firstUnit.id));

  const confirm = await confirmPartyRequest({
    requestId: a.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: a.version, idempotencyKey: "confirm_" + key + "_A",
    bookingUnitId: firstUnit.id,
  });
  assert.equal(confirm.confirmed, true);
  assert.equal(confirm.addonRequests, 1);
  const replayConfirm = await confirmPartyRequest({
    requestId: a.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: a.version, idempotencyKey: "confirm_" + key + "_A",
    bookingUnitId: firstUnit.id,
  });
  assert.equal(replayConfirm.alreadyConfirmed, true);
  const allocation = await prisma.bookingAllocation.findFirstOrThrow({
    where: { bookingRequestId: a.requestId },
  });
  assert.equal(allocation.status, "CONFIRMED");
  assert.equal(allocation.bookingUnitId, firstUnit.id);
  assert.equal(await prisma.bookingRequest.count({ where: { partyOrderItem: { partyOrderId: a.draftId } } }), 2);
  assert.equal(await prisma.partyOutbox.count({
    where: { aggregateId: a.requestId, eventType: "PARTY_BOOKING_CONFIRMED" },
  }), 1);
  console.log("PASS resource CONFIRMED + one add-on request, quote replay no duplicate");

  const addonRequest = await prisma.bookingRequest.findFirstOrThrow({
    where: { partyOrderItem: { partyOrderId: a.draftId, role: "STANDALONE" } },
    select: { id: true, partyStage: true },
  });
  assert.equal(addonRequest.partyStage, "SENT");
  const addonReply = await replyToPartyRequest({
    businessId: bizB.id, actorUserId: ownerB.id, requestId: addonRequest.id,
    idempotencyKey: "addon_quote_" + key,
    input: { expectedStage: "SENT", expectedQuoteVersion: 0,
      type: "AS_REQUESTED", priceByn: 120, includes: "Фото праздника" },
  });
  await acceptPartyQuote({
    userId: parent.id, orderId: a.draftId, requestId: addonRequest.id,
    quoteId: addonReply.quote.id, expectedVersion: 1,
  });
  const addonConfirm = await confirmPartyRequest({
    requestId: addonRequest.id, businessId: bizB.id, actorUserId: ownerB.id,
    expectedQuoteVersion: 1, idempotencyKey: "addon_confirm_" + key,
  });
  assert.equal(addonConfirm.confirmed, true);
  assert.equal(await prisma.bookingAllocation.count({
    where: { bookingRequestId: addonRequest.id },
  }), 0);
  console.log("PASS after anchor, standalone provider can confirm without inventory");

  const b = await createRequest("B");
  await acceptPartyQuote({ userId: parent.id, orderId: b.draftId, requestId: b.requestId,
    quoteId: b.quoteId, expectedVersion: b.version });
  const bChoices = await listPartyConfirmChoices(bizA.id, b.requestId);
  assert.ok(!bChoices.units.some((u) => u.id === firstUnit.id), "occupied room must be absent from preview");
  await expectPartyError(409, () => confirmPartyRequest({
    requestId: b.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: b.version, idempotencyKey: "busy", bookingUnitId: firstUnit.id,
  }), "cannot double-book existing allocation");

  const raceUnit = await createUnit("race");
  const [c, d] = await Promise.all([createRequest("C"), createRequest("D")]);
  await Promise.all([c, d].map(v => acceptPartyQuote({
    userId: parent.id, orderId: v.draftId, requestId: v.requestId,
    quoteId: v.quoteId, expectedVersion: v.version,
  })));
  const contenders = [c, d];
  const results = await Promise.allSettled(contenders.map((v, i) => confirmPartyRequest({
    requestId: v.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: v.version, idempotencyKey: "race_" + key + "_" + i,
    bookingUnitId: raceUnit.id,
  })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1,
    "one and only one concurrent confirmation should succeed");
  assert.equal(results.filter(r => r.status === "rejected").length, 1);
  assert.equal(await prisma.bookingAllocation.count({
    where: { bookingUnitId: raceUnit.id, status: "CONFIRMED" },
  }), 1);
  console.log("PASS concurrent confirmation: exactly one booked resource");

  // Manual confirmation is deliberate and never fabricates a BookingAllocation.
  const manualDraft = await createPartyDraft(parent.id, { citySlug: "minsk", venueMode: "HOME" });
  const manualSelected = await updatePartyDraft(parent.id, manualDraft.id, {
    version: manualDraft.version, anchorOfferId: "it-offer-anim", addonOfferIds: [],
  });
  const manualReady = await updatePartyDraft(parent.id, manualDraft.id, {
    version: manualSelected.version, eventDate: date, timeFrom: "12:00", timeTo: "15:00",
    childrenCount: 8, adultsCount: 4, childName: "IT Manual",
    contactName: "IT Parent", contactPhone: "+375291112233",
  });
  const manualRequest = await submitPartyAnchor(parent.id, manualDraft.id,
    manualReady.version, "manual_" + key);
  const manualQuote = await replyToPartyRequest({
    businessId: bizB.id, actorUserId: ownerB.id, requestId: manualRequest.request.id,
    idempotencyKey: "manual_quote_" + key,
    input: { expectedStage: "SENT", expectedQuoteVersion: 0,
      type: "AS_REQUESTED", priceByn: 180, includes: "Аниматор выездной" },
  });
  await acceptPartyQuote({ userId: parent.id, orderId: manualDraft.id,
    requestId: manualRequest.request.id, quoteId: manualQuote.quote.id, expectedVersion: 1 });
  const manualChoices = await listPartyConfirmChoices(bizB.id, manualRequest.request.id);
  assert.equal(manualChoices.manualAllowed, true);
  assert.equal(manualChoices.units.length, 0);
  await confirmPartyRequest({
    requestId: manualRequest.request.id, businessId: bizB.id, actorUserId: ownerB.id,
    expectedQuoteVersion: 1, idempotencyKey: "manual_confirm_" + key,
  });
  assert.equal(await prisma.bookingAllocation.count({
    where: { bookingRequestId: manualRequest.request.id },
  }), 0);
  console.log("PASS HOME/manual confirmation without fake resource allocation");

  const closedUnit = await createUnit("closed");
  await prisma.availabilityException.create({
    data: { bookingUnitId: closedUnit.id, date: utcDate, kind: "CLOSED",
      startMinutes: 720, endMinutes: 900 },
  });
  const closedParty = await createRequest("E");
  await acceptPartyQuote({ userId: parent.id, orderId: closedParty.draftId,
    requestId: closedParty.requestId, quoteId: closedParty.quoteId,
    expectedVersion: closedParty.version });
  const closedPreview = await listPartyConfirmChoices(bizA.id, closedParty.requestId);
  assert.ok(!closedPreview.units.some((u) => u.id === closedUnit.id));
  await expectPartyError(409, () => confirmPartyRequest({
    requestId: closedParty.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: closedParty.version, idempotencyKey: "closed_" + key,
    bookingUnitId: closedUnit.id,
  }), "closed availability exception blocks confirmation");
  await prisma.availabilityException.deleteMany({ where: { bookingUnitId: closedUnit.id } });
  await prisma.calendarBlock.create({
    data: { bookingUnitId: closedUnit.id,
      blockStart: new Date(date + "T09:30:00Z"),
      blockEnd: new Date(date + "T10:00:00Z"), note: "IT block" },
  });
  await expectPartyError(409, () => confirmPartyRequest({
    requestId: closedParty.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: closedParty.version, idempotencyKey: "blocked_" + key,
    bookingUnitId: closedUnit.id,
  }), "calendar block prevents confirmation");

  const smallUnit = await createUnit("small");
  await prisma.bookingUnit.update({ where: { id: smallUnit.id },
    data: { capacity: 2 } });
  await expectPartyError(422, () => confirmPartyRequest({
    requestId: closedParty.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: closedParty.version, idempotencyKey: "capacity_" + key,
    bookingUnitId: smallUnit.id,
  }), "capacity less than guest count");
  await prisma.bookingUnit.update({ where: { id: smallUnit.id },
    data: { status: "INACTIVE" } });
  await expectPartyError(422, () => confirmPartyRequest({
    requestId: closedParty.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: closedParty.version, idempotencyKey: "inactive_" + key,
    bookingUnitId: smallUnit.id,
  }), "disabled room cannot be booked");
  await expectPartyError(422, () => confirmPartyRequest({
    requestId: closedParty.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: closedParty.version, idempotencyKey: "crossunit_" + key,
    bookingUnitId: "different-company-room",
  }), "foreign room cannot be booked");
  await expectPartyError(422, () => confirmPartyRequest({
    requestId: closedParty.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: closedParty.version, idempotencyKey: "missingunit_" + key,
  }), "multiple rooms require explicit selection");

  const heldUnit = await createUnit("standard_hold");
  const heldBooking = await prisma.bookingRequest.create({
    data: { businessId: bizA.id, userId: parent.id,
      publicationType: "OFFER", offerId: anchorOffer.id,
      customerName: "IT Customer", customerPhone: "+375291112233",
      kind: "STANDARD", status: "NEW", lastActivityAt: new Date() },
  });
  const heldAllocation = await prisma.bookingAllocation.create({
    data: {
      bookingRequestId: heldBooking.id, bookingUnitId: heldUnit.id,
      blockStart: new Date(date + "T08:30:00Z"),
      blockEnd: new Date(date + "T12:30:00Z"),
      status: "HELD", expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  await expectPartyError(409, () => confirmPartyRequest({
    requestId: closedParty.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: closedParty.version, idempotencyKey: "held_" + key,
    bookingUnitId: heldUnit.id,
  }), "STANDARD booking HELD allocation blocks party booking");
  assert.equal((await prisma.bookingAllocation.findUniqueOrThrow({
    where: { id: heldAllocation.id },
    select: { status: true },
  })).status, "HELD", "an unexpired STANDARD hold must not be expired by SQL timezone coercion");
  await prisma.bookingAllocation.update({
    where: { id: heldAllocation.id }, data: { status: "RELEASED" },
  });

  const activeAlternative = await createUnit("active_alternative");
  const recover = await confirmPartyRequest({
    requestId: closedParty.requestId, businessId: bizA.id, actorUserId: ownerA.id,
    expectedQuoteVersion: closedParty.version, idempotencyKey: "active_alt_" + key,
    bookingUnitId: activeAlternative.id,
  });
  assert.equal(recover.confirmed, true);
  console.log("PASS disabled room does not block available alternative");

  // Quote expiry prevents accepting and does not create an allocation.
  const expireParty = await createRequest("F");
  await prisma.partyQuote.update({ where: { id: expireParty.quoteId },
    data: { validUntil: new Date(Date.now() - 60_000) } });
  await expectPartyError(410, () => acceptPartyQuote({
    userId: parent.id, orderId: expireParty.draftId, requestId: expireParty.requestId,
    quoteId: expireParty.quoteId, expectedVersion: expireParty.version,
  }), "expired quote cannot be accepted");
  console.log("PASS manual, closed-hours, calendar, capacity, inactive, cross-tenant and expiry cases");

}

main().catch((error) => {
  console.error("PARTY_IT_FAILED:", error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
