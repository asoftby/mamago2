import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { dispatchQueuedPartyInvites } from "./partyInviteTransactionalDispatch.service";

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
  } finally {
    await prisma.partyOrder.delete({ where: { id: order.id } });
  }
}
main().finally(() => prisma.$disconnect());
