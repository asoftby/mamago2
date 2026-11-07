import { lockPartyRequestGroup } from "./partyRequestLock";
import "server-only";
import { BookingKind, BookingStatus, PartyOrderStatus, PartyItemStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";
import { partyResponseDeadline } from "./partyResponseDeadline";
import { assertPartyConfirmationEnabled } from "./partyConfirmationFlag";

/**
 * Parent accepts a particular quote/version, NOT a reservation.
 * Confirmation and resource allocation remain a separate guarded business step.
 */
type QuoteDecisionInput = {
  userId: string;
  orderId: string;
  requestId: string;
  quoteId: string;
  expectedVersion: number;
};
export async function acceptPartyQuote(input: QuoteDecisionInput) {
  const result = await decidePartyQuote(input, false);
  return { ...result, alreadyAccepted: result.alreadyDecided };
}
export async function rejectPartyQuote(input: QuoteDecisionInput) {
  const result = await decidePartyQuote(input, true);
  return { ...result, alreadyRejected: result.alreadyDecided };
}
async function decidePartyQuote(input: QuoteDecisionInput, rejecting: boolean) {
  const { userId, orderId, requestId, quoteId, expectedVersion } = input;
  assertPartyConfirmationEnabled();
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await lockPartyRequestGroup(tx, requestId);

    const request = await tx.bookingRequest.findFirst({
      where: { id: requestId, kind: BookingKind.PARTY,
        partyOrderItem: { partyOrderId: orderId, partyOrder: { ownerUserId: userId } } },
      select: {
        id: true, partyStage: true, status: true, lastActivityAt: true,
        partyOrderItem: { select: { id: true, role: true,
          partyOrder: { select: { id: true, ownerUserId: true, status: true, eventDate: true, timeFrom: true } },
        } },
        partyQuotes: { orderBy: { version: "desc" }, take: 1,
          select: { id: true, version: true, status: true, validUntil: true, decidedByUserId: true } },
      },
    });
    if (!request) throw new PartyApiError(404, "Заявка не найдена");
    const latest = request.partyQuotes[0];
    if (latest?.id === quoteId && latest.version === expectedVersion &&
        latest.status === (rejecting ? "REJECTED" : "ACCEPTED") && latest.decidedByUserId === userId &&
        request.partyStage === (rejecting ? "NOT_ACCEPTED" : "AWAITING_RECONFIRM")) {
      return { requestId, quoteId, awaitingBusinessConfirmation: !rejecting, alreadyDecided: true };
    }
    const item = request.partyOrderItem;
    const order = item?.partyOrder;
    if (!item || !order || !order.eventDate || !order.timeFrom ||
        (order.status !== PartyOrderStatus.ANCHOR_PENDING && order.status !== PartyOrderStatus.ANCHOR_CONFIRMED)) {
      throw new PartyApiError(409, "Праздник больше не принимает предложения");
    }
    if (request.partyStage !== "QUOTED" || request.status !== BookingStatus.NEW ||
        latest?.id !== quoteId || latest.version !== expectedVersion || latest.status !== "ACTIVE") {
      throw new PartyApiError(409, "Предложение уже изменилось, обновите страницу");
    }
    if (!latest.validUntil || latest.validUntil <= now ||
        partyStartAt(order.eventDate, order.timeFrom) <= now) {
      throw new PartyApiError(410, "Срок предложения истёк");
    }

    if (partyStartAt(order.eventDate, order.timeFrom).getTime() <= now.getTime() + 3_600_000) {
      throw new PartyApiError(410, "Слишком поздно для подтверждения");
    }

    // Protect against acceptance racing with the business response/expiry.
    const claimed = await tx.bookingRequest.updateMany({
      where: { id: requestId, kind: BookingKind.PARTY, status: BookingStatus.NEW,
        partyStage: "QUOTED", lastActivityAt: request.lastActivityAt },
      data: { partyStage: rejecting ? "NOT_ACCEPTED" : "AWAITING_RECONFIRM", lastActivityAt: now,
        ...(rejecting ? { status: BookingStatus.CANCELLED, partyCloseReason: "CUSTOMER_CANCELLED" as const } : {}),
        responseDueAt: rejecting ? null : partyResponseDeadline(now, partyStartAt(order.eventDate, order.timeFrom)) },
    });
    if (claimed.count !== 1) throw new PartyApiError(409, "Заявка уже изменена");
    const quote = await tx.partyQuote.updateMany({
      where: { id: quoteId, bookingRequestId: requestId, version: expectedVersion,
        status: "ACTIVE", validUntil: { gt: now } },
      data: { status: rejecting ? "REJECTED" : "ACCEPTED", decidedAt: now, decidedByUserId: userId },
    });
    if (quote.count !== 1) throw new PartyApiError(409, "Предложение уже изменено");
    // Rejection closes this proposal only. Other invited providers may still reply.
    // Serialize the aggregate decision with concurrent replies/cancellation first.
    let alternativesRemain = false;
    if (rejecting) {
      await tx.$queryRaw`SELECT "id" FROM "PartyOrder" WHERE "id" = ${orderId} FOR UPDATE`;
      const [active, queued] = await Promise.all([
        tx.bookingRequest.count({ where: { partyOrderItemId: item.id, id: { not: requestId },
          kind: BookingKind.PARTY, status: BookingStatus.NEW,
          partyStage: { in: ["SENT", "QUOTED", "AWAITING_RECONFIRM"] } } }),
        tx.partyProviderInvite.count({ where: { partyOrderItemId: item.id, status: "QUEUED" } }),
      ]);
      alternativesRemain = active + queued > 0;
    }
    const updatedOrder = await tx.partyOrder.updateMany({
      where: { id: orderId, ownerUserId: userId,
        status: { in: [PartyOrderStatus.ANCHOR_PENDING, PartyOrderStatus.ANCHOR_CONFIRMED] } },
      data: { version: { increment: 1 },
        ...(rejecting && !alternativesRemain && item.role === "ANCHOR" ? { status: PartyOrderStatus.NEEDS_ALTERNATIVE } : {}) },
    });
    if (updatedOrder.count !== 1) throw new PartyApiError(409, "Праздник уже изменился");
    if (rejecting) await tx.partyProviderInvite.updateMany({
      where: { bookingRequestId: requestId, status: { in: ["QUOTED", "ACCEPTED"] } },
      data: { status: "CANCELLED", resolvedAt: now },
    });
    await tx.partyOrderItem.update({
      where: { id: item.id }, data: { status: rejecting && alternativesRemain ? PartyItemStatus.REQUESTED : PartyItemStatus.NEEDS_DECISION },
    });
    await tx.bookingActivity.create({
      data: { bookingId: requestId, type: "STATUS_CHANGED", actorType: "CUSTOMER", actorId: userId,
        payload: { quoteId, version: expectedVersion, fromStage: "QUOTED",
          toStage: rejecting ? "NOT_ACCEPTED" : "AWAITING_RECONFIRM", confirmed: false } },
    });
    await tx.partyOutbox.create({
      data: { eventType: rejecting ? "PARTY_REQUEST_CANCELLED" : "PARTY_QUOTE_ACCEPTED", aggregateId: requestId,
        dedupeKey: "party:" + requestId + (rejecting ? ":rejected:" : ":accepted:") + quoteId,
        payload: { requestId, partyOrderId: orderId, quoteId } },
    });
    return { requestId, quoteId, awaitingBusinessConfirmation: !rejecting, alreadyDecided: false };
  });
}
