import "server-only";
import { BookingKind, BookingStatus, PartyItemStatus, PartyOrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError } from "./partyDraft.validation";
import { partyCancelBlocker } from "./partyCancelRules";

/** Request stages that are still open: the business may still answer or confirm. */
const OPEN_STAGES = ["SENT", "QUOTED", "AWAITING_RECONFIRM"] as const;

/**
 * Parent cancels a party before any confirmation (#818 D1): every open request is closed
 * as CUSTOMER_CANCELLED, active or accepted offers are withdrawn, items and the order
 * become CANCELLED. Nothing is allocated before a confirmation, so nothing is released.
 * Requests are locked before the order (same order as acceptance, confirmation, expiry).
 */
export async function cancelPartyBeforeConfirmation(
  ownerUserId: string, partyId: string, expectedVersion: number,
) {
  return prisma.$transaction(async (tx) => {
    // FOR UPDATE on the order's requests in a stable order, then the order itself.
    await tx.$queryRaw`
      SELECT br."id" FROM "BookingRequest" br
      JOIN "PartyOrderItem" poi ON poi."id" = br."partyOrderItemId"
      WHERE poi."partyOrderId" = ${partyId} AND br."kind" = 'PARTY'
      ORDER BY br."id" FOR UPDATE OF br`;
    await tx.$queryRaw`SELECT "id" FROM "PartyOrder" WHERE "id" = ${partyId} FOR UPDATE`;
    const order = await tx.partyOrder.findFirst({
      where: { id: partyId, ownerUserId },
      select: {
        id: true, status: true, version: true,
        items: { select: { id: true, status: true, confirmedBookingRequestId: true } },
      },
    });
    if (!order) throw new PartyApiError(404, "Праздник не найден");
    if (order.status === PartyOrderStatus.CANCELLED) {
      return { partyId, cancelled: true, alreadyCancelled: true, closedRequests: 0 };
    }
    if (order.version !== expectedVersion) {
      throw new PartyApiError(409, "Праздник изменился. Обновите страницу");
    }
    const blocker = partyCancelBlocker(order);
    if (blocker) throw new PartyApiError(409, blocker);

    const now = new Date();
    const open = await tx.bookingRequest.findMany({
      where: { kind: BookingKind.PARTY, partyOrderItem: { partyOrderId: partyId },
        partyStage: { in: [...OPEN_STAGES] } },
      select: { id: true, partyStage: true },
    });
    for (const request of open) {
      await tx.bookingRequest.update({
        where: { id: request.id },
        data: {
          partyStage: "CANCELLED", status: BookingStatus.CANCELLED,
          partyCloseReason: "CUSTOMER_CANCELLED", responseDueAt: null, lastActivityAt: now,
        },
      });
      await tx.partyQuote.updateMany({
        where: { bookingRequestId: request.id, status: { in: ["ACTIVE", "ACCEPTED"] } },
        data: { status: "WITHDRAWN", decidedAt: now },
      });
      await tx.bookingActivity.create({
        data: {
          bookingId: request.id, type: "REQUEST_WITHDRAWN", actorType: "CUSTOMER",
          actorId: ownerUserId,
          payload: { reason: "CUSTOMER_CANCELLED", fromStage: request.partyStage, partyOrderId: partyId },
        },
      });
    }
    await tx.partyOrderItem.updateMany({
      where: { partyOrderId: partyId,
        status: { notIn: [PartyItemStatus.CANCELLED, PartyItemStatus.DECLINED, PartyItemStatus.EXPIRED] } },
      data: { status: PartyItemStatus.CANCELLED },
    });
    const claimed = await tx.partyOrder.updateMany({
      where: { id: partyId, ownerUserId, version: expectedVersion,
        status: { not: PartyOrderStatus.CANCELLED } },
      data: { status: PartyOrderStatus.CANCELLED, cancelledAt: now, version: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new PartyApiError(409, "Праздник изменился. Обновите страницу");
    return { partyId, cancelled: true, alreadyCancelled: false, closedRequests: open.length,
      closedRequestIds: open.map((request) => request.id) };
  });
}
