import "server-only";
import { BookingKind, BookingStatus, PartyOrderStatus, PartyItemStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";

/**
 * Parent accepts a particular quote/version, NOT a reservation.
 * Confirmation and resource allocation remain a separate guarded business step.
 */
export async function acceptPartyQuote(input: {
  userId: string;
  orderId: string;
  requestId: string;
  quoteId: string;
  expectedVersion: number;
}) {
  const { userId, orderId, requestId, quoteId, expectedVersion } = input;
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Lock request before order: consistent with response and expiry workers.
    const requests = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "BookingRequest" WHERE "id" = ${requestId} FOR UPDATE
    `;
    if (requests.length !== 1) throw new PartyApiError(404, "Заявка не найдена");

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
        latest.status === "ACCEPTED" && latest.decidedByUserId === userId &&
        request.partyStage === "AWAITING_RECONFIRM") {
      return { requestId, quoteId, awaitingBusinessConfirmation: true, alreadyAccepted: true };
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
      data: { partyStage: "AWAITING_RECONFIRM", lastActivityAt: now,
        responseDueAt: new Date(Math.min(
          now.getTime() + 2 * 3_600_000,
          partyStartAt(order.eventDate, order.timeFrom).getTime() - 3_600_000,
        )) },
    });
    if (claimed.count !== 1) throw new PartyApiError(409, "Заявка уже изменена");
    const quote = await tx.partyQuote.updateMany({
      where: { id: quoteId, bookingRequestId: requestId, version: expectedVersion,
        status: "ACTIVE", validUntil: { gt: now } },
      data: { status: "ACCEPTED", decidedAt: now, decidedByUserId: userId },
    });
    if (quote.count !== 1) throw new PartyApiError(409, "Предложение уже изменено");
    const updatedOrder = await tx.partyOrder.updateMany({
      where: { id: orderId, ownerUserId: userId,
        status: { in: [PartyOrderStatus.ANCHOR_PENDING, PartyOrderStatus.ANCHOR_CONFIRMED] } },
      data: { version: { increment: 1 } },
    });
    if (updatedOrder.count !== 1) throw new PartyApiError(409, "Праздник уже изменился");
    await tx.partyOrderItem.update({
      where: { id: item.id }, data: { status: PartyItemStatus.NEEDS_DECISION },
    });
    await tx.bookingActivity.create({
      data: { bookingId: requestId, type: "STATUS_CHANGED", actorType: "USER", actorId: userId,
        payload: { quoteId, version: expectedVersion, fromStage: "QUOTED",
          toStage: "AWAITING_RECONFIRM", confirmed: false } },
    });
    await tx.partyOutbox.create({
      data: { eventType: "PARTY_QUOTE_ACCEPTED", aggregateId: requestId,
        dedupeKey: "party:" + requestId + ":accepted:" + quoteId,
        payload: { requestId, partyOrderId: orderId, quoteId } },
    });
    return { requestId, quoteId, awaitingBusinessConfirmation: true, alreadyAccepted: false };
  });
}
