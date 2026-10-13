import "server-only";
import { BookingKind, BookingStatus, PartyOrderStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";

export type QuoteResolution =
  | { action: "EXTEND"; expectedQuoteVersion: number; validUntil: Date }
  | { action: "CLOSE"; expectedQuoteVersion: number };

/**
 * Из QUOTED с истёкшей ACTIVE quote: новое предложение той же цены/условий
 * (с новой версией) или завершение запроса бизнесом. CAS + idempotency.
 */
export async function resolveExpiredPartyQuote(input: {
  businessId: string;
  requestId: string;
  actorUserId: string;
  key: string;
  resolution: QuoteResolution;
}) {
  const { businessId, requestId, actorUserId, key, resolution } = input;
  const existing = await prisma.bookingRequest.findFirst({
    where: { id: requestId, businessId, kind: BookingKind.PARTY },
    select: {
      id: true, partyStage: true, status: true, lastActivityAt: true,
      partyOrderItem: {
        select: { id: true, role: true,
          partyOrder: { select: {
            id: true, ownerUserId: true, status: true, eventDate: true, timeFrom: true,
          } },
        },
      },
      partyQuotes: {
        orderBy: { version: "desc" }, take: 1,
        select: {
          id: true, version: true, type: true, status: true, priceByn: true,
          includes: true, durationMinutes: true, prepaymentTerms: true,
          cancellationTerms: true, changeReason: true, validUntil: true,
          bookingUnitId: true, serviceStart: true, serviceEnd: true,
        },
      },
    },
  });
  if (!existing) throw new PartyApiError(404, "Заявка не найдена");
  // Business request replays must not create another quote.
  if (resolution.action === "EXTEND") {
    const repeated = await prisma.partyQuote.findUnique({
      where: { bookingRequestId_idempotencyKey: { bookingRequestId: requestId, idempotencyKey: key } },
      select: { id: true, version: true, status: true },
    });
    if (repeated) return { requestId, quote: repeated, alreadyProcessed: true };
  } else if (existing.partyStage === "NOT_ACCEPTED" &&
             existing.status === BookingStatus.CANCELLED) {
    return { requestId, closed: true, alreadyProcessed: true };
  }

  const quote = existing.partyQuotes[0];
  const item = existing.partyOrderItem;
  const order = item?.partyOrder;
  if (!quote || !item || !order || !order.eventDate || !order.timeFrom ||
      existing.partyStage !== "QUOTED" || existing.status !== BookingStatus.NEW ||
      ![PartyOrderStatus.ANCHOR_PENDING, PartyOrderStatus.ANCHOR_CONFIRMED].includes(order.status) ||
      quote.version !== resolution.expectedQuoteVersion ||
      !quote.validUntil || quote.validUntil > new Date() ||
      quote.status !== "ACTIVE" || quote.type === "DECLINED" || !quote.priceByn || !quote.includes) {
    throw new PartyApiError(409, "Предложение уже изменено или не требует действия");
  }
  const now = new Date();
  const eventStart = partyStartAt(order.eventDate, order.timeFrom);
  if (eventStart <= now) throw new PartyApiError(410, "Дата праздника уже прошла");
  if (resolution.action === "EXTEND" &&
      (resolution.validUntil <= new Date(now.getTime() + 60_000) ||
       resolution.validUntil > new Date(Math.min(eventStart.getTime() - 3_600_000, now.getTime() + 24 * 3_600_000)))) {
    throw new PartyApiError(422, "Новый срок должен быть в пределах 24 часов и до начала праздника");
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.bookingRequest.updateMany({
      where: {
        id: requestId, businessId, kind: BookingKind.PARTY,
        status: BookingStatus.NEW, partyStage: "QUOTED",
        lastActivityAt: existing.lastActivityAt,
      },
      data: {
        lastActivityAt: now,
        ...(resolution.action === "CLOSE" ? {
          partyStage: "NOT_ACCEPTED" as const,
          partyCloseReason: "BUSINESS_CANCELLED" as const,
          status: BookingStatus.CANCELLED,
        } : {}),
      },
    });
    if (claimed.count !== 1) throw new PartyApiError(409, "Заявка уже изменилась");

    const updatedOrder = await tx.partyOrder.updateMany({
      where: {
        id: order.id, status: { in: [PartyOrderStatus.ANCHOR_PENDING, PartyOrderStatus.ANCHOR_CONFIRMED] },
      },
      data: {
        version: { increment: 1 },
        ...(resolution.action === "CLOSE" && item.role === "ANCHOR"
          ? { status: PartyOrderStatus.NEEDS_ALTERNATIVE } : {}),
      },
    });
    if (updatedOrder.count !== 1) throw new PartyApiError(409, "Праздник уже изменился");

    const superseded = await tx.partyQuote.updateMany({
      where: { id: quote.id, version: quote.version, status: "ACTIVE" },
      data: { status: resolution.action === "CLOSE" ? "WITHDRAWN" : "SUPERSEDED", decidedAt: now },
    });
    if (superseded.count !== 1) throw new PartyApiError(409, "Предложение уже изменилось");

    if (resolution.action === "CLOSE") {
      await tx.partyOrderItem.update({
        where: { id: item.id }, data: { status: "CANCELLED" },
      });
      await tx.bookingActivity.create({
        data: {
          bookingId: requestId, type: "REQUEST_WITHDRAWN", actorType: "BUSINESS",
          actorId: actorUserId, payload: { quoteId: quote.id, reason: "BUSINESS_CANCELLED" },
        },
      });
      await tx.partyOutbox.create({
        data: {
          eventType: "PARTY_QUOTE_CLOSED", aggregateId: requestId,
          dedupeKey: "party:" + requestId + ":quote-closed",
          payload: { requestId, partyOrderId: order.id, userId: order.ownerUserId },
        },
      });
      return { requestId, closed: true, alreadyProcessed: false };
    }

    const nextQuote = await tx.partyQuote.create({
      data: {
        bookingRequestId: requestId, version: quote.version + 1,
        idempotencyKey: key, respondedByUserId: actorUserId,
        type: quote.type, status: "ACTIVE",
        priceByn: quote.priceByn, includes: quote.includes,
        durationMinutes: quote.durationMinutes,
        prepaymentTerms: quote.prepaymentTerms,
        cancellationTerms: quote.cancellationTerms, changeReason: quote.changeReason,
        validUntil: resolution.validUntil,
        bookingUnitId: quote.bookingUnitId,
        serviceStart: quote.serviceStart, serviceEnd: quote.serviceEnd,
      },
      select: { id: true, version: true, status: true },
    });
    await tx.bookingActivity.create({
      data: {
        bookingId: requestId, type: "QUOTE_SENT", actorType: "BUSINESS", actorId: actorUserId,
        payload: { quoteId: nextQuote.id, version: nextQuote.version, reason: "EXTENDED" },
      },
    });
    await tx.partyOutbox.create({
      data: {
        eventType: "PARTY_QUOTE_SENT", aggregateId: requestId,
        dedupeKey: "party:" + requestId + ":quote:" + nextQuote.id,
        payload: { requestId, partyOrderId: order.id, quoteId: nextQuote.id, userId: order.ownerUserId },
      },
    });
    return { requestId, quote: nextQuote, alreadyProcessed: false };
  });
}
