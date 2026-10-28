import "server-only";

import prisma from "@/lib/prisma";
import { PartyOrderStatus, type Prisma } from "@prisma/client";

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
        await settleExpiredPartyItem(tx, request.partyOrderItem.id,
          request.partyOrderItem.role === "ANCHOR");
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
  return expired + await expirePartyQuotes(now, limit);
}

class QuoteRaceLost extends Error {}

/**
 * A QUOTED request whose active offer passed `validUntil` without the parent accepting
 * it is closed by the server (owner decision, #818): quote EXPIRED, request NOT_ACCEPTED,
 * anchor order NEEDS_ALTERNATIVE, and both the parent and the business are notified.
 * CAS on `lastActivityAt` and the quote status makes a concurrent acceptance or
 * extension win cleanly; nothing was allocated for a QUOTED request, so nothing is released.
 */
async function expirePartyQuotes(now: Date, limit: number) {
  const due = await prisma.bookingRequest.findMany({
    where: {
      kind: "PARTY", partyStage: "QUOTED", status: "NEW",
      partyQuotes: { some: { status: "ACTIVE", validUntil: { lte: now } } },
    },
    orderBy: { lastActivityAt: "asc" },
    take: Math.min(100, Math.max(1, limit)),
    select: {
      id: true, lastActivityAt: true,
      partyOrderItem: { select: { id: true, role: true, partyOrderId: true } },
      partyQuotes: {
        where: { status: "ACTIVE", validUntil: { lte: now } },
        select: { id: true }, take: 1,
      },
    },
  });
  let expired = 0;
  for (const request of due) {
    const quote = request.partyQuotes[0];
    if (!quote) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const changed = await tx.bookingRequest.updateMany({
          where: {
            id: request.id, kind: "PARTY", partyStage: "QUOTED", status: "NEW",
            lastActivityAt: request.lastActivityAt,
          },
          // NOT_ACCEPTED pairs with CANCELLED (assertPartyStatusPair, business inbox);
          // partyCloseReason tells the expiry apart from a business closing the offer.
          data: {
            partyStage: "NOT_ACCEPTED", partyCloseReason: "EXPIRED",
            status: "CANCELLED", lastActivityAt: now,
          },
        });
        if (changed.count !== 1) throw new QuoteRaceLost();
        const closed = await tx.partyQuote.updateMany({
          where: { id: quote.id, status: "ACTIVE", validUntil: { lte: now } },
          data: { status: "EXPIRED", decidedAt: now },
        });
        if (closed.count !== 1) throw new QuoteRaceLost();
        if (request.partyOrderItem) {
          await settleExpiredPartyItem(tx, request.partyOrderItem.id,
            request.partyOrderItem.role === "ANCHOR");
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
            payload: { reason: "QUOTE_VALIDITY", quoteId: quote.id },
          },
        });
        await tx.partyOutbox.createMany({
          data: [
            { eventType: "PARTY_QUOTE_EXPIRED", aggregateId: request.id,
              dedupeKey: "party:" + request.id + ":quote-expired:" + quote.id,
              payload: { requestId: request.id, quoteId: quote.id } },
            { eventType: "PARTY_QUOTE_EXPIRED_BUSINESS", aggregateId: request.id,
              dedupeKey: "party:" + request.id + ":quote-expired-business:" + quote.id,
              payload: { requestId: request.id, quoteId: quote.id } },
          ],
        });
      });
      expired++;
    } catch (error) {
      // A concurrent acceptance or extension changed the request first: leave it.
      if (!(error instanceof QuoteRaceLost)) throw error;
    }
  }
  return expired;
}

/**
 * A timeout belongs to one request, not the entire service. Another invited
 * business may still have a live request or quote. Serialize the final item
 * transition with confirmations and candidate dispatch.
 */
async function settleExpiredPartyItem(
  tx: Prisma.TransactionClient, itemId: string, isAnchor: boolean,
) {
  await tx.$queryRaw`SELECT "id" FROM "PartyOrderItem"
    WHERE "id" = ${itemId} FOR UPDATE`;
  const item = await tx.partyOrderItem.findUnique({
    where: { id: itemId },
    select: { status: true, confirmedBookingRequestId: true },
  });
  if (!item || item.confirmedBookingRequestId ||
      item.status === "CONFIRMED" || item.status === "CANCELLED") return;
  if (!isAnchor) {
    const active = await tx.bookingRequest.count({
      where: { partyOrderItemId: itemId, kind: "PARTY", status: "NEW",
        partyStage: { in: ["SENT", "QUOTED", "AWAITING_RECONFIRM"] } },
    });
    if (active > 0) {
      if (item.status !== "REQUESTED") {
        await tx.partyOrderItem.update({
          where: { id: itemId }, data: { status: "REQUESTED" },
        });
      }
      return;
    }
  }
  await tx.partyOrderItem.update({
    where: { id: itemId }, data: { status: "EXPIRED" },
  });
}
