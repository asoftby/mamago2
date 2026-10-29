import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { dispatchQueuedPartyInvites } from "./partyInviteTransactionalDispatch.service";
import { replyToPartyRequest } from "./partyBusiness.service";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55443" ||
  url.pathname !== "/mamago_birthday_it") throw new Error("SAFE ABORT: isolated birthday DB only");

async function main() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "parent@it.test" } });
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: "it-offer-photo" },
    select: { id: true, place: { select: { ownerBusinessId: true } } } });
  assert.ok(offer.place?.ownerBusinessId);
  const date = new Date(Date.now() + 12 * 86_400_000).toISOString().slice(0, 10);
  const order = await prisma.partyOrder.create({ data: {
    ownerUserId: owner.id, citySlug: "minsk", venueMode: "HOME", status: "ANCHOR_CONFIRMED",
    eventDate: new Date(date + "T00:00:00Z"), timeFrom: "12:00", timeTo: "15:00",
    childrenCount: 8, adultsCount: 3, childAge: 7,
  } });
  const item = await prisma.partyOrderItem.create({ data: {
    partyOrderId: order.id, role: "STANDALONE", category: "PHOTO", status: "PLANNED",
  } });
  try {
    await prisma.partyProviderInvite.create({ data: {
      partyOrderItemId: item.id, offerId: offer.id,
      businessId: offer.place.ownerBusinessId!, position: 0, mode: "SEQUENTIAL",
    } });
    // Both invocations compete for the same item lock. Only one BookingRequest
    // and one outbox event may be created.
    const results = await Promise.allSettled([
      dispatchQueuedPartyInvites(item.id), dispatchQueuedPartyInvites(item.id),
    ]);
    assert.ok(results.some(r => r.status === "fulfilled"), JSON.stringify(results));
    assert.equal(await prisma.bookingRequest.count({ where: { partyOrderItemId: item.id } }), 1);
    const invite = await prisma.partyProviderInvite.findFirstOrThrow({
      where: { partyOrderItemId: item.id },
    });
    assert.equal(invite.status, "SENT");
    assert.ok(invite.bookingRequestId);
    assert.equal(await prisma.partyOutbox.count({
      where: { aggregateId: invite.bookingRequestId, eventType: "PARTY_REQUEST_SENT" },
    }), 1);
    const replay = await dispatchQueuedPartyInvites(item.id);
    assert.equal(replay.sent, 0);
    assert.equal(await prisma.bookingRequest.count({ where: { partyOrderItemId: item.id } }), 1);
    console.log("PASS competing queued dispatch and replay: exactly one request/outbox");

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: offer.place.ownerBusinessId! }, select: { ownerUserId: true },
    });
    const respond = (type: "DECLINED" | "AS_REQUESTED", key: string) =>
      replyToPartyRequest({
        businessId: offer.place.ownerBusinessId!, actorUserId: business.ownerUserId,
        requestId: invite.bookingRequestId!, idempotencyKey: key,
        input: type === "DECLINED"
          ? { expectedStage: "SENT", expectedQuoteVersion: 0,
              type: "DECLINED", declineReason: "DATE_BUSY" }
          : { expectedStage: "SENT", expectedQuoteVersion: 0,
              type: "AS_REQUESTED", priceByn: 120, includes: "Фотосъёмка" },
      });
    // Two mutually exclusive business replies race for the same BookingRequest.
    const replies = await Promise.allSettled([
      respond("DECLINED", "race_decline_" + item.id),
      respond("AS_REQUESTED", "race_quote_" + item.id),
    ]);
    assert.equal(replies.filter(x => x.status === "fulfilled").length, 1,
      "Exactly one competing business response should commit");
    const request = await prisma.bookingRequest.findUniqueOrThrow({
      where: { id: invite.bookingRequestId! },
    });
    const persistedInvite = await prisma.partyProviderInvite.findUniqueOrThrow({
      where: { id: invite.id },
    });
    assert.ok(request.partyStage === "DECLINED" || request.partyStage === "QUOTED");
    assert.equal(persistedInvite.status, request.partyStage);
    assert.equal(await prisma.partyQuote.count({
      where: { bookingRequestId: request.id },
    }), 1);
    assert.equal(await prisma.partyOutbox.count({
      where: { aggregateId: request.id, eventType: {
        in: ["PARTY_REQUEST_DECLINED", "PARTY_QUOTE_SENT"],
      } },
    }), 1);
    // A fully declined item is terminal; a quoted item remains in decision mode.
    // Neither outcome may generate another request.
    const afterReply = await Promise.allSettled([dispatchQueuedPartyInvites(item.id)]);
    if (request.partyStage === "QUOTED") {
      assert.equal(afterReply[0].status, "fulfilled");
      if (afterReply[0].status === "fulfilled") assert.equal(afterReply[0].value.sent, 0);
    } else {
      assert.equal(afterReply[0].status, "rejected");
    }
    assert.equal(await prisma.bookingRequest.count({ where: { partyOrderItemId: item.id } }), 1);
    console.log("PASS competing decline/quote: one winner, consistent queue and outbox");
  } finally {
    await prisma.partyOrder.delete({ where: { id: order.id } });
  }
}
main().finally(() => prisma.$disconnect());
