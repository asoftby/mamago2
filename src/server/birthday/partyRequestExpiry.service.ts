import "server-only";

import prisma from "@/lib/prisma";
import { PartyOrderStatus } from "@prisma/client";

/** Expire unanswered requests by server time; never rely on a browser timer. */
export async function expirePartyRequests(limit = 50) {
  const now = new Date();
  const due = await prisma.bookingRequest.findMany({
    where: {
      kind: "PARTY",
      partyStage: { in: ["SENT", "AWAITING_RECONFIRM"] },
      responseDueAt: { lte: now },
    },
    orderBy: { responseDueAt: "asc" },
    take: Math.min(100, Math.max(1, limit)),
    select: {
      id: true, partyOrderItem: {
        select: { id: true, role: true, partyOrderId: true },
      },
    },
  });
  let expired = 0;
  for (const request of due) {
    const didExpire = await prisma.$transaction(async (tx) => {
      const changed = await tx.bookingRequest.updateMany({
        where: {
          id: request.id, kind: "PARTY",
          partyStage: { in: ["SENT", "AWAITING_RECONFIRM"] },
          responseDueAt: { lte: now },
        },
        data: {
          partyStage: "EXPIRED", partyCloseReason: "EXPIRED",
          status: "EXPIRED", lastActivityAt: now,
        },
      });
      if (changed.count !== 1) return false;
      if (request.partyOrderItem) {
        await tx.partyOrderItem.update({
          where: { id: request.partyOrderItem.id },
          data: { status: "EXPIRED" },
        });
        if (request.partyOrderItem.role === "ANCHOR") {
          await tx.partyOrder.updateMany({
            where: {
              id: request.partyOrderItem.partyOrderId,
              status: { in: [PartyOrderStatus.ANCHOR_PENDING, PartyOrderStatus.ANCHOR_CONFIRMED] },
            },
            data: { status: PartyOrderStatus.NEEDS_ALTERNATIVE, version: { increment: 1 } },
          });
        }
      }
      await tx.bookingActivity.create({
        data: {
          bookingId: request.id, type: "REQUEST_EXPIRED", actorType: "SYSTEM",
          payload: { reason: "RESPONSE_DEADLINE" },
        },
      });
      await tx.partyOutbox.create({
        data: {
          eventType: "PARTY_REQUEST_EXPIRED",
          aggregateId: request.id,
          dedupeKey: "party:" + request.id + ":expired",
          payload: { requestId: request.id },
        },
      });
      return true;
    });
    if (didExpire) expired++;
  }
  return expired;
}
