import "server-only";

import { BookingKind, BookingStatus, Prisma, ScheduleKind } from "@prisma/client";
import prisma from "@/lib/prisma";
import { loadSlotSnapshot } from "@/server/offers/getSlots";
import { calculateSlots } from "@/server/offers/slotAvailability";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";

const HOUR = 3_600_000;

function assertMatchingQuote<Q extends { id: string; version: number; status: string }>(
  request: { partyStage: string | null; partyQuotes: Q[] },
  expectedQuoteVersion: number,
  stage: string,
): Q {
  const quote = request.partyQuotes[0];
  if (request.partyStage !== stage || !quote || quote.version !== expectedQuoteVersion) {
    throw new PartyApiError(409, "Предложение изменилось. Обновите страницу");
  }
  return quote;
}

/** Parent accepts precisely one active quote; this is NOT a confirmed booking. */
export async function acceptPartyQuote(params: {
  ownerUserId: string;
  partyId: string;
  requestId: string;
  expectedQuoteVersion: number;
  idempotencyKey: string;
}) {
  const { ownerUserId, partyId, requestId, expectedQuoteVersion } = params;
  const now = new Date();
  const row = await prisma.bookingRequest.findFirst({
    where: { id: requestId, kind: BookingKind.PARTY, partyOrderItem: {
      partyOrderId: partyId, role: "ANCHOR", partyOrder: { ownerUserId },
    } },
    select: {
      id: true, partyStage: true, status: true, lastActivityAt: true,
      partyOrderItem: { select: { id: true, partyOrder: {
        select: { id: true, ownerUserId: true, eventDate: true, timeFrom: true, status: true },
      } } },
      partyQuotes: { orderBy: { version: "desc" }, take: 1, select: {
        id: true, version: true, status: true, validUntil: true, type: true, priceByn: true,
        decidedByUserId: true,
      } },
    },
  });
  if (!row || !row.partyOrderItem) throw new PartyApiError(404, "Заявка не найдена");
  const quote = row.partyQuotes[0];
  if (row.partyStage === "AWAITING_RECONFIRM" && row.status === BookingStatus.NEW &&
      quote?.version === expectedQuoteVersion && quote.status === "ACCEPTED" &&
      quote.decidedByUserId === ownerUserId) {
    return { requestId, quoteId: quote.id, status: "AWAITING_RECONFIRM", alreadyProcessed: true };
  }
  const selected = assertMatchingQuote(row, expectedQuoteVersion, "QUOTED");
  const order = row.partyOrderItem.partyOrder;
  if (row.status !== BookingStatus.NEW || order.status !== "ANCHOR_PENDING" ||
      !order.eventDate || !order.timeFrom ||
      selected.status !== "ACTIVE" || selected.type === "DECLINED" ||
      !selected.priceByn || !selected.validUntil || selected.validUntil <= now) {
    throw new PartyApiError(409, "Предложение уже недоступно для принятия");
  }
  const start = partyStartAt(order.eventDate, order.timeFrom);
  const due = new Date(Math.min(now.getTime() + 2 * HOUR, start.getTime() - HOUR));
  if (due <= now) throw new PartyApiError(410, "Для подтверждения уже недостаточно времени");

  return prisma.$transaction(async (tx) => {
    const claim = await tx.bookingRequest.updateMany({
      where: {
        id: requestId, kind: BookingKind.PARTY, status: BookingStatus.NEW,
        partyStage: "QUOTED", lastActivityAt: row.lastActivityAt,
      },
      data: { partyStage: "AWAITING_RECONFIRM", responseDueAt: due, lastActivityAt: now },
    });
    if (claim.count !== 1) throw new PartyApiError(409, "Заявка уже изменилась");
    const decided = await tx.partyQuote.updateMany({
      where: {
        id: selected.id, bookingRequestId: requestId,
        version: expectedQuoteVersion, status: "ACTIVE",
        validUntil: { gt: now },
      },
      data: { status: "ACCEPTED", decidedAt: now, decidedByUserId: ownerUserId },
    });
    if (decided.count !== 1) throw new PartyApiError(409, "Предложение уже изменилось");
    const orderClaim = await tx.partyOrder.updateMany({
      where: { id: partyId, ownerUserId, status: "ANCHOR_PENDING" },
      data: { version: { increment: 1 } },
    });
    if (orderClaim.count !== 1) throw new PartyApiError(409, "Праздник изменился");
    await tx.bookingActivity.create({
      data: {
        bookingId: requestId, type: "QUOTE_ACCEPTED", actorType: "CUSTOMER", actorId: ownerUserId,
        payload: { quoteId: selected.id, version: expectedQuoteVersion, idempotencyKey: params.idempotencyKey },
      },
    });
    await tx.partyOutbox.create({
      data: {
        eventType: "PARTY_QUOTE_ACCEPTED", aggregateId: requestId,
        dedupeKey: "party:" + requestId + ":quote-accepted:" + selected.id,
        payload: { partyOrderId: partyId, requestId, quoteId: selected.id },
      },
    });
    return { requestId, quoteId: selected.id, status: "AWAITING_RECONFIRM", alreadyProcessed: false };
  });
}

function isAllocationConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string; meta?: { code?: string; database_error?: string } };
  return value.code === "23P01" ||
    (value.code === "P2010" && value.meta?.code === "23P01") ||
    Boolean(value.message?.includes("BookingAllocation_no_active_overlap") ||
      value.meta?.database_error?.includes("BookingAllocation_no_active_overlap"));
}

/** Business confirms an accepted ANCHOR quote only against a real available BookingUnit. */
export async function confirmPartyAnchor(params: {
  actorUserId: string;
  businessId: string;
  requestId: string;
  expectedQuoteVersion: number;
  bookingUnitId: string;
  idempotencyKey: string;
}) {
  const { actorUserId, businessId, requestId, expectedQuoteVersion, bookingUnitId } = params;
  const now = new Date();
  const row = await prisma.bookingRequest.findFirst({
    where: { id: requestId, businessId, kind: BookingKind.PARTY },
    select: {
      id: true, offerId: true, partyStage: true, status: true, lastActivityAt: true,
      responseDueAt: true,
      partyOrderItem: { select: { id: true, role: true, confirmedBookingRequestId: true,
        partyOrder: { select: { id: true, ownerUserId: true, status: true, eventDate: true,
          timeFrom: true, timeTo: true, contactName: true, contactPhone: true } },
      } },
      partyQuotes: { orderBy: { version: "desc" }, take: 1, select: {
        id: true, version: true, status: true, validUntil: true,
        bookingUnitId: true, serviceStart: true, serviceEnd: true, decidedByUserId: true,
      } },
    },
  });
  if (!row || !row.partyOrderItem || row.partyOrderItem.role !== "ANCHOR") {
    throw new PartyApiError(404, "Заявка на площадку не найдена");
  }
  const quote = row.partyQuotes[0];
  if (row.partyStage === "CONFIRMED" && row.status === BookingStatus.CONFIRMED &&
      quote?.version === expectedQuoteVersion && quote.status === "ACCEPTED" &&
      quote.bookingUnitId === bookingUnitId &&
      row.partyOrderItem.confirmedBookingRequestId === requestId) {
    return { requestId, quoteId: quote.id, status: "CONFIRMED", alreadyProcessed: true };
  }
  const selected = assertMatchingQuote(row, expectedQuoteVersion, "AWAITING_RECONFIRM");
  const order = row.partyOrderItem.partyOrder;
  if (row.status !== BookingStatus.NEW || selected.status !== "ACCEPTED" ||
      !selected.decidedByUserId || !row.responseDueAt || row.responseDueAt <= now ||
      order.status !== "ANCHOR_PENDING" || !order.eventDate || !order.timeFrom || !order.timeTo ||
      !order.contactName?.trim() || !order.contactPhone?.trim() || !row.offerId ||
      (selected.bookingUnitId && selected.bookingUnitId !== bookingUnitId)) {
    throw new PartyApiError(409, "Праздник или предложение больше нельзя подтвердить");
  }
  const start = selected.serviceStart ?? partyStartAt(order.eventDate, order.timeFrom);
  const end = selected.serviceEnd ?? partyStartAt(order.eventDate, order.timeTo);
  if (start <= now || end <= start || end.getTime() - start.getTime() > 24 * HOUR) {
    throw new PartyApiError(422, "Некорректное время бронирования");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock the request before the party order, as in the existing birthday services.
      const claim = await tx.bookingRequest.updateMany({
        where: {
          id: requestId, businessId, kind: BookingKind.PARTY,
          partyStage: "AWAITING_RECONFIRM", status: BookingStatus.NEW,
          lastActivityAt: row.lastActivityAt, responseDueAt: { gt: now },
        },
        data: { partyStage: "CONFIRMED", status: BookingStatus.CONFIRMED,
          lastActivityAt: now, responseDueAt: null,
          customerName: order.contactName, customerPhone: order.contactPhone,
          startsAt: start, endsAt: end,
        },
      });
      if (claim.count !== 1) throw new PartyApiError(409, "Заявка уже изменилась");
      const orderClaim = await tx.partyOrder.updateMany({
        where: { id: order.id, status: "ANCHOR_PENDING" },
        data: { status: "ANCHOR_CONFIRMED", version: { increment: 1 } },
      });
      if (orderClaim.count !== 1) throw new PartyApiError(409, "Праздник уже изменился");

      // The resource must belong to the offer/business and be reservable, not merely present.
      const unit = await tx.bookingUnit.findFirst({
        where: { id: bookingUnitId, businessId, status: "ACTIVE", type: "EXCLUSIVE",
          offers: { some: { offerId: row.offerId! } } },
        select: { id: true, prepMinutes: true, cleanupMinutes: true },
      });
      const offer = await tx.offer.findUnique({
        where: { id: row.offerId! },
        select: { status: true, bookingEnabled: true, bookingMode: true,
          place: { select: { ownerBusinessId: true } },
          offerBooking: { select: { scheduleKind: true } } },
      });
      if (!unit || !offer || offer.status !== "PUBLISHED" ||
          offer.place?.ownerBusinessId !== businessId || !offer.bookingEnabled ||
          (offer.bookingMode !== "USE_PUBLICATION_SLOTS" &&
           offer.bookingMode !== "USE_PUBLICATION_DATES") ||
          offer.offerBooking?.scheduleKind !== ScheduleKind.ON_REQUEST_WINDOWS) {
        throw new PartyApiError(422, "У предложения нет доступного ресурса по расписанию");
      }
      // Same expiration semantics as reserveSlot, within the transaction.
      await tx.$executeRaw`UPDATE "BookingAllocation" SET "status" = 'EXPIRED', "updatedAt" = now()
        WHERE "bookingUnitId" = ${bookingUnitId} AND "status" = 'HELD' AND "expiresAt" < now()`;
      const snapshot = await loadSlotSnapshot({
        offerId: row.offerId!, from: start, to: new Date(start.getTime() + 1),
      }, tx);
      if (!snapshot || snapshot.scheduleKind !== ScheduleKind.ON_REQUEST_WINDOWS) {
        throw new PartyApiError(422, "Расписание больше недоступно");
      }
      const eligible = calculateSlots(snapshot, { from: start, to: new Date(start.getTime() + 1) }, now)
        .some(slot => slot.startsAt.getTime() === start.getTime() &&
          slot.endsAt.getTime() === end.getTime() && slot.unitIds.includes(bookingUnitId));
      if (!eligible) throw new PartyApiError(409, "Ресурс уже занят или время изменилось");
      const buffer = snapshot.bufferMin;
      await tx.bookingAllocation.create({
        data: {
          bookingUnitId, bookingRequestId: requestId, partyQuoteId: selected.id,
          blockStart: new Date(start.getTime() - unit.prepMinutes * 60_000),
          blockEnd: new Date(end.getTime() + (unit.cleanupMinutes + buffer) * 60_000),
          status: "CONFIRMED", expiresAt: null,
        },
      });
      const assigned = await tx.partyQuote.updateMany({
        where: { id: selected.id, bookingRequestId: requestId,
          version: expectedQuoteVersion, status: "ACCEPTED",
          bookingUnitId: selected.bookingUnitId },
        data: { bookingUnitId, serviceStart: start, serviceEnd: end },
      });
      if (assigned.count !== 1) throw new PartyApiError(409, "Версия предложения изменена");
      const itemClaim = await tx.partyOrderItem.updateMany({
        where: { id: row.partyOrderItem!.id, confirmedBookingRequestId: null,
          role: "ANCHOR", status: "NEEDS_DECISION" },
        data: { status: "CONFIRMED", confirmedBookingRequestId: requestId },
      });
      if (itemClaim.count !== 1) throw new PartyApiError(409, "Площадка уже подтверждена");
      await tx.bookingActivity.create({
        data: { bookingId: requestId, type: "STATUS_CHANGED", actorType: "BUSINESS",
          actorId: actorUserId, payload: { fromStage: "AWAITING_RECONFIRM",
            toStage: "CONFIRMED", quoteId: selected.id, bookingUnitId,
            idempotencyKey: params.idempotencyKey } },
      });
      await tx.partyOutbox.create({
        data: {
          eventType: "PARTY_BOOKING_CONFIRMED", aggregateId: requestId,
          dedupeKey: "party:" + requestId + ":confirmed:" + selected.id,
          payload: { requestId, partyOrderId: order.id, quoteId: selected.id,
            ownerUserId: order.ownerUserId },
        },
      });
      return { requestId, quoteId: selected.id, status: "CONFIRMED", alreadyProcessed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 });
  } catch (error) {
    if (isAllocationConflict(error)) throw new PartyApiError(409, "Ресурс только что заняли");
    throw error;
  }
}


/** Preview eligible resources for the business confirmation dialog, no PII. */
export async function listConfirmablePartyUnits(params: {
  businessId: string;
  requestId: string;
}) {
  const { businessId, requestId } = params;
  const row = await prisma.bookingRequest.findFirst({
    where: { id: requestId, kind: BookingKind.PARTY, businessId,
      partyStage: "AWAITING_RECONFIRM", status: BookingStatus.NEW },
    select: {
      id: true, offerId: true, responseDueAt: true,
      partyOrderItem: { select: { role: true,
        partyOrder: { select: { status: true, eventDate: true, timeFrom: true, timeTo: true } },
      } },
      partyQuotes: { take: 1, orderBy: { version: "desc" }, select: {
        id: true, version: true, status: true, bookingUnitId: true,
        serviceStart: true, serviceEnd: true,
      } },
    },
  });
  const order = row?.partyOrderItem?.partyOrder;
  const quote = row?.partyQuotes[0];
  const now = new Date();
  if (!row || !row.offerId || !order || row.partyOrderItem?.role !== "ANCHOR" ||
      order.status !== "ANCHOR_PENDING" || !order.eventDate || !order.timeFrom ||
      !order.timeTo || !quote || quote.status !== "ACCEPTED" ||
      !row.responseDueAt || row.responseDueAt <= now) {
    throw new PartyApiError(409, "Заявка пока не ожидает подтверждения");
  }
  const start = quote.serviceStart ?? partyStartAt(order.eventDate, order.timeFrom);
  const end = quote.serviceEnd ?? partyStartAt(order.eventDate, order.timeTo);
  if (start <= now || end <= start) {
    return { requestId, quoteVersion: quote.version, units: [] };
  }
  const snapshot = await loadSlotSnapshot({
    offerId: row.offerId, from: start, to: new Date(start.getTime() + 1),
  });
  if (!snapshot || snapshot.scheduleKind !== ScheduleKind.ON_REQUEST_WINDOWS) {
    return { requestId, quoteVersion: quote.version, units: [] };
  }
  const candidate = calculateSlots(snapshot, { from: start, to: new Date(start.getTime() + 1) }, now)
    .find(slot => slot.startsAt.getTime() === start.getTime() &&
      slot.endsAt.getTime() === end.getTime());
  const ids = candidate?.unitIds.filter(id => !quote.bookingUnitId || quote.bookingUnitId === id) ?? [];
  if (!ids.length) return { requestId, quoteVersion: quote.version, units: [] };
  const units = await prisma.bookingUnit.findMany({
    where: { id: { in: ids }, businessId, status: "ACTIVE", type: "EXCLUSIVE",
      offers: { some: { offerId: row.offerId } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { requestId, quoteVersion: quote.version, units };
}
