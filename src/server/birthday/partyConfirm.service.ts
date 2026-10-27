import "server-only";
import {
  BookingKind, BookingStatus, PartyItemRole, PartyItemStatus,
  PartyOrderStatus, Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";
import { verifyPartyOffers } from "./partyDraft.service";
import {
  allocatePartyUnit, isAllocationOverlapError, lockAvailablePartyUnit, type PartyUnitWindow,
} from "./partyUnitAllocation";
import { requestPartyAddonsAfterAnchor } from "./partyAddonFanout";

export interface ConfirmPartyRequestInput {
  requestId: string;
  businessId: string;
  actorUserId: string;
  expectedQuoteVersion: number;
  idempotencyKey: string;
  bookingUnitId?: string;
}


/**
 * Actual business confirmation. Re-checks the accepted quote and unit under
 * transaction locks, allocates venue capacity exactly once and only then marks
 * the request CONFIRMED. Add-ons are contacted after anchor confirmation.
 */
export async function confirmPartyRequest(input: ConfirmPartyRequestInput) {
  const { requestId, businessId, actorUserId, expectedQuoteVersion, idempotencyKey } = input;
  const dedupeKey = `party:${requestId}:confirmed:${idempotencyKey}`;
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "BookingRequest"
        WHERE "id" = ${requestId} FOR UPDATE`;
      const now = new Date();
      const req = await tx.bookingRequest.findFirst({
        where: { id: requestId, businessId, kind: BookingKind.PARTY },
        select: {
          id: true, status: true, partyStage: true, responseDueAt: true, lastActivityAt: true,
          offerId: true, partyOrderItem: {
            select: { id: true, role: true, status: true, offerId: true,
              partyOrder: { select: {
                id: true, ownerUserId: true, status: true, venueMode: true,
                version: true, citySlug: true, eventDate: true,
                timeFrom: true, timeTo: true, childrenCount: true,
                adultsCount: true, childAge: true,
              } },
            },
          },
          partyQuotes: { orderBy: { version: "desc" }, take: 1,
            select: {
              id: true, version: true, status: true, priceByn: true,
              includes: true, decidedByUserId: true, bookingUnitId: true,
              serviceStart: true, serviceEnd: true,
            },
          },
        },
      });
      if (!req) throw new PartyApiError(404, "Праздничная заявка не найдена");
      const item = req.partyOrderItem;
      const order = item?.partyOrder;
      const quote = req.partyQuotes[0];
      const isAnchor = item?.role === PartyItemRole.ANCHOR;

      if (req.status === BookingStatus.CONFIRMED && req.partyStage === "CONFIRMED") {
        const previouslyConfirmed = await tx.partyOutbox.findUnique({
          where: { dedupeKey }, select: { id: true },
        });
        if (previouslyConfirmed && quote?.version === expectedQuoteVersion) {
          return { requestId, confirmed: true, alreadyConfirmed: true };
        }
        throw new PartyApiError(409, "Заявка уже подтверждена");
      }

      if (!item || !order || !req.offerId || !order.eventDate ||
          !order.timeFrom || !order.timeTo || !quote ||
          req.status !== BookingStatus.NEW || req.partyStage !== "AWAITING_RECONFIRM" ||
          quote.version !== expectedQuoteVersion || quote.status !== "ACCEPTED" ||
          quote.decidedByUserId !== order.ownerUserId || !quote.priceByn ||
          !quote.includes || !req.responseDueAt || req.responseDueAt <= now) {
        throw new PartyApiError(409, "Подтверждение неактуально, обновите заявку");
      }
      if (isAnchor && order.status !== PartyOrderStatus.ANCHOR_PENDING ||
          !isAnchor && order.status !== PartyOrderStatus.ANCHOR_CONFIRMED) {
        throw new PartyApiError(409, "Сначала должна быть подтверждена основная услуга");
      }
      if (partyStartAt(order.eventDate, order.timeFrom) <= now) {
        throw new PartyApiError(410, "Дата праздника уже прошла");
      }

      // A business cannot confirm a withdrawn or reassigned publication.
      const verified = await verifyPartyOffers(order.citySlug, [req.offerId], tx);
      const offer = verified.get(req.offerId);
      if (!offer || offer.place?.ownerBusinessId !== businessId) {
        throw new PartyApiError(422, "Услуга больше не доступна у этого исполнителя");
      }

      const associated = await tx.bookingUnitOffer.findMany({
        where: { offerId: req.offerId },
        select: { bookingUnit: {
          select: { id: true, businessId: true, status: true, timezone: true,
            prepMinutes: true, cleanupMinutes: true, minDurationMinutes: true, capacity: true,
            rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
          },
        } },
      });
      const units = associated.map((v) => v.bookingUnit)
        .filter((unit) => unit.businessId === businessId && unit.status === "ACTIVE");

      // Venue and packages are never confirmed without exclusive inventory.
      const venueRequired = isAnchor &&
        (order.venueMode === "VENUE" || order.venueMode === "PACKAGE");
      if (venueRequired && units.length === 0) {
        throw new PartyApiError(422, "Настройте ресурс площадки для подтверждения");
      }
      // An inactive room must not disable the entire offer when another
      // active room remains available. The requested ID is checked below.
      const selectedId = input.bookingUnitId ?? quote.bookingUnitId ??
        (units.length === 1 ? units[0]?.id : undefined);
      const unit = selectedId ? units.find((candidate) => candidate.id === selectedId) : undefined;
      if ((units.length > 0 && !unit) || (selectedId && !unit)) {
        throw new PartyApiError(422, "Выберите доступный зал или ресурс");
      }
      if (quote.bookingUnitId && quote.bookingUnitId !== selectedId) {
        throw new PartyApiError(409, "Выбранный ресурс отличается от предложения");
      }

      let window: PartyUnitWindow | null = null;
      if (unit) {
        window = await lockAvailablePartyUnit(tx, {
          unitId: unit.id, businessId, offerId: req.offerId, order: { ...order,
            eventDate: order.eventDate, timeFrom: order.timeFrom, timeTo: order.timeTo }, now,
        });
        if (quote.serviceStart && quote.serviceStart.getTime() !== window.serviceStart.getTime() ||
            quote.serviceEnd && quote.serviceEnd.getTime() !== window.serviceEnd.getTime()) {
          throw new PartyApiError(409, "Время отличается от принятого предложения");
        }
      }

      const claimed = await tx.bookingRequest.updateMany({
        where: { id: requestId, businessId, status: BookingStatus.NEW,
          partyStage: "AWAITING_RECONFIRM", lastActivityAt: req.lastActivityAt,
          responseDueAt: { gt: now } },
        data: { partyStage: "CONFIRMED", status: BookingStatus.CONFIRMED,
          lastActivityAt: now, responseDueAt: null },
      });
      if (claimed.count !== 1) throw new PartyApiError(409, "Заявку уже изменили");

      const advanced = await tx.partyOrder.updateMany({
        where: { id: order.id, version: order.version,
          status: isAnchor ? PartyOrderStatus.ANCHOR_PENDING : PartyOrderStatus.ANCHOR_CONFIRMED },
        data: {
          version: { increment: 1 },
          ...(isAnchor ? { status: PartyOrderStatus.ANCHOR_CONFIRMED } : {}),
        },
      });
      if (advanced.count !== 1) throw new PartyApiError(409, "Заказ уже изменился");
      await tx.partyOrderItem.update({
        where: { id: item.id },
        data: { status: PartyItemStatus.CONFIRMED, confirmedBookingRequestId: requestId,
          offerPriceSnapshot: quote.priceByn },
      });
      if (unit && window) {
        await allocatePartyUnit(tx, { unitId: unit.id, requestId, quoteId: quote.id, window });
      }

      await tx.bookingActivity.create({
        data: { bookingId: requestId, type: "STATUS_CHANGED", actorType: "BUSINESS",
          actorId: actorUserId,
          payload: { quoteId: quote.id, quoteVersion: quote.version,
            toStage: "CONFIRMED", unitId: unit?.id ?? null } },
      });
      await tx.partyOutbox.create({
        data: { eventType: "PARTY_BOOKING_CONFIRMED", aggregateId: requestId,
          dedupeKey,
          payload: { partyOrderId: order.id, requestId, quoteId: quote.id, userId: order.ownerUserId } },
      });

      // The first business confirmation activates parallel add-on requests.
      // A failure during fan-out rolls the whole confirmation back.
      const addonRequests = isAnchor ? await requestPartyAddonsAfterAnchor(tx, {
        order: { ...order, eventDate: order.eventDate, timeFrom: order.timeFrom },
        anchorRequestId: requestId, now,
      }) : 0;
      return { requestId, confirmed: true, alreadyConfirmed: false, addonRequests };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 });
  } catch (error) {
    if (isAllocationOverlapError(error)) throw new PartyApiError(409, "Этот ресурс только что заняли");
    throw error;
  }
}
