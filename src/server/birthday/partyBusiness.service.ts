import { BookingKind, BookingStatus, PartyItemStatus, PartyOrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";
import { isPartyAttentionStage, type PartyBusinessReply } from "./partyBusiness.validation";
import { redactPartyContacts } from "./partyPrivacy";

export async function listBusinessPartyRequests(businessId: string, onlyAttention = false) {
  const where: Prisma.BookingRequestWhereInput = {
    businessId, kind: BookingKind.PARTY,
    ...(onlyAttention ? { partyStage: { in: ["SENT", "AWAITING_RECONFIRM"] } } : {}),
  };
  const [rows, attentionCount] = await Promise.all([
    prisma.bookingRequest.findMany({
      where, take: 100, orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
      select: {
        id: true, partyStage: true, status: true, createdAt: true,
        responseDueAt: true, firstResponseAt: true,
        requestedDate: true, requestedTime: true, adultsCount: true, childrenCount: true,
        childAge: true,
        offer: { select: { id: true, title: true } },
        partyOrderItem: {
          select: {
            id: true, role: true, category: true, note: true,
            partyOrder: {
              select: {
                id: true, citySlug: true, eventDate: true, timeFrom: true,
                timeTo: true, childrenCount: true, adultsCount: true,
                childAge: true, budgetByn: true, status: true,
              },
            },
          },
        },
        partyQuotes: {
          orderBy: { version: "desc" },
          select: {
            id: true, version: true, type: true, status: true, priceByn: true,
            includes: true, durationMinutes: true, changeReason: true,
            prepaymentTerms: true, cancellationTerms: true,
            declineReason: true, declineComment: true, validUntil: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.bookingRequest.count({
      where: { businessId, kind: BookingKind.PARTY,
        partyStage: { in: ["SENT", "AWAITING_RECONFIRM"] } },
    }),
  ]);
  // Deliberately do not select parent contactName/contactPhone/childName,
  // user relation, or private attachments. Business sees a service brief only.
  return {
    items: rows.map((row) => ({
      ...row,
      partyOrderItem: row.partyOrderItem
        ? { ...row.partyOrderItem, note: redactPartyContacts(row.partyOrderItem.note) }
        : null,
    })),
    attentionCount,
  };
}

export async function replyToPartyRequest(params: {
  businessId: string;
  actorUserId: string;
  requestId: string;
  idempotencyKey: string;
  input: PartyBusinessReply;
}) {
  const { businessId, actorUserId, requestId, idempotencyKey, input } = params;
  const existing = await prisma.bookingRequest.findFirst({
    where: { id: requestId, businessId, kind: BookingKind.PARTY },
    select: {
      id: true, createdAt: true, partyStage: true, lastActivityAt: true,
      firstResponseAt: true, responseDueAt: true, partyOrderItemId: true,
      partyOrderItem: {
        select: {
          id: true, role: true, status: true,
          partyOrder: { select: {
            id: true, ownerUserId: true, eventDate: true,
            timeFrom: true, status: true,
          } },
        },
      },
      partyQuotes: {
        orderBy: { version: "desc" }, take: 1,
        select: { id: true, version: true },
      },
    },
  });
  if (!existing) throw new PartyApiError(404, "Праздничная заявка не найдена");

  // Retry after a successful write returns the same quote even when the stage
  // has advanced. DB unique(bookingRequestId, idempotencyKey) is the final guard.
  const repeated = await prisma.partyQuote.findUnique({
    where: { bookingRequestId_idempotencyKey: { bookingRequestId: requestId, idempotencyKey } },
    select: { id: true, version: true, type: true, status: true },
  });
  if (repeated) return { requestId, quote: repeated, alreadyResponded: true };

  if (!isPartyAttentionStage(existing.partyStage) ||
      existing.partyStage !== input.expectedStage ||
      (existing.partyQuotes[0]?.version ?? 0) !== input.expectedQuoteVersion) {
    throw new PartyApiError(409, "Заявка уже изменилась. Обновите список");
  }
  const item = existing.partyOrderItem;
  const order = item?.partyOrder;
  if (!item || !order || order.status === PartyOrderStatus.CANCELLED ||
      (order.status !== PartyOrderStatus.ANCHOR_PENDING && order.status !== PartyOrderStatus.ANCHOR_CONFIRMED)) {
    throw new PartyApiError(409, "Праздник больше не принимает отклики");
  }
  const now = new Date();
  if (!existing.responseDueAt || existing.responseDueAt <= now) {
    throw new PartyApiError(410, "Срок ответа истёк");
  }
  if (!order.eventDate || !order.timeFrom) throw new PartyApiError(422, "Не задано время праздника");
  const startAt = partyStartAt(order.eventDate, order.timeFrom);
  if (startAt <= now) throw new PartyApiError(410, "Дата праздника уже прошла");
  const expiresAt = new Date(Math.min(now.getTime() + 24 * 3_600_000, startAt.getTime() - 3_600_000));
  if (input.type !== "DECLINED" && expiresAt <= now) {
    throw new PartyApiError(410, "Слишком поздно для предложения");
  }
  const version = (existing.partyQuotes[0]?.version ?? 0) + 1;
  const declined = input.type === "DECLINED";

  return prisma.$transaction(async (tx) => {
    // Serialize against cancellation/changes to the parent party. This order
    // guard must be inside the same transaction as the quote and activity.
    const orderClaim = await tx.partyOrder.updateMany({
      where: {
        id: order.id,
        status: { in: [PartyOrderStatus.ANCHOR_PENDING, PartyOrderStatus.ANCHOR_CONFIRMED] },
      },
      data: {
        version: { increment: 1 },
        ...(item.role === "ANCHOR" ? {
          status: declined ? PartyOrderStatus.NEEDS_ALTERNATIVE : PartyOrderStatus.ANCHOR_PENDING,
        } : {}),
      },
    });
    if (orderClaim.count !== 1) throw new PartyApiError(409, "Праздник уже изменён");

    // Compare-and-swap prevents two concurrent replies from both producing quotes.
    const claimed = await tx.bookingRequest.updateMany({
      where: {
        id: requestId, businessId, kind: BookingKind.PARTY,
        partyStage: input.expectedStage,
        lastActivityAt: existing.lastActivityAt,
        responseDueAt: { gt: now },
      },
      data: {
        partyStage: declined ? "DECLINED" : "QUOTED",
        ...(declined ? { status: BookingStatus.REJECTED, rejectedAt: now,
          partyCloseReason: "BUSINESS_DECLINED" } : {
          status: BookingStatus.NEW,
          partyCloseReason: null,
        }),
        lastActivityAt: now,
        ...(existing.firstResponseAt ? {} : {
          firstResponseAt: now,
          responseTimeMinutes: Math.max(0, Math.round((now.getTime() - existing.createdAt.getTime()) / 60_000)),
        }),
      },
    });
    if (claimed.count !== 1) throw new PartyApiError(409, "Заявка уже изменена");

    await tx.partyQuote.updateMany({
      where: { bookingRequestId: requestId, status: "ACTIVE" },
      data: { status: "SUPERSEDED", decidedAt: now },
    });
    const quote = await tx.partyQuote.create({
      data: {
        bookingRequestId: requestId, version, idempotencyKey,
        respondedByUserId: actorUserId, type: input.type,
        status: declined ? "REJECTED" : "ACTIVE",
        ...(declined ? {
          declineReason: input.declineReason,
          declineComment: input.declineComment ?? null,
        } : {
          priceByn: new Prisma.Decimal(input.priceByn),
          includes: input.includes,
          durationMinutes: input.durationMinutes ?? null,
          prepaymentTerms: input.prepaymentTerms ?? null,
          cancellationTerms: input.cancellationTerms ?? null,
          changeReason: input.type === "MODIFIED" ? input.changeReason : null,
          validUntil: expiresAt,
        }),
      },
      select: { id: true, version: true, type: true, status: true },
    });
    await tx.partyOrderItem.update({
      where: { id: item.id },
      data: { status: declined ? PartyItemStatus.DECLINED : PartyItemStatus.NEEDS_DECISION },
    });
    await tx.bookingActivity.create({
      data: {
        bookingId: requestId,
        type: declined ? "STATUS_CHANGED" : "QUOTE_SENT",
        actorType: "BUSINESS", actorId: actorUserId,
        payload: { quoteId: quote.id, version, type: input.type,
          fromStage: input.expectedStage, toStage: declined ? "DECLINED" : "QUOTED" },
      },
    });
    await tx.partyOutbox.create({
      data: {
        eventType: declined ? "PARTY_REQUEST_DECLINED" : "PARTY_QUOTE_SENT",
        aggregateId: requestId,
        dedupeKey: "party:" + requestId + ":quote:" + quote.id,
        payload: { partyOrderId: order.id, requestId, quoteId: quote.id, userId: order.ownerUserId },
      },
    });
    return { requestId, quote, alreadyResponded: false };
  });
}
