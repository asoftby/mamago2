import "server-only";
import {
  BookingKind, BookingStatus, PartyItemRole, PartyItemStatus,
  PartyOrderStatus, Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";
import { verifyPartyOffers } from "./partyDraft.service";
import { isWithinSchedule, minskBookingWindow } from "./partyConfirmationAvailability";
import { partyResponseDeadline } from "./partyResponseDeadline";

export interface ConfirmPartyRequestInput {
  requestId: string;
  businessId: string;
  actorUserId: string;
  expectedQuoteVersion: number;
  idempotencyKey: string;
  bookingUnitId?: string;
}

function exclusionViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string; meta?: { code?: string } };
  return value.code === "23P01" ||
    (value.code === "P2010" && value.meta?.code === "23P01") ||
    Boolean(value.message?.includes("BookingAllocation_no_active_overlap"));
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

      let serviceStart: Date | null = null;
      let serviceEnd: Date | null = null;
      let blockStart: Date | null = null;
      let blockEnd: Date | null = null;
      if (unit) {
        // Lock the canonical resource *before* reading availability; a stale
        // preflight snapshot must not authorize a room just disabled by admin.
        await tx.$queryRaw`SELECT "id" FROM "BookingUnit" WHERE "id" = ${unit.id} FOR UPDATE`;
        const locked = await tx.bookingUnit.findUnique({
          where: { id: unit.id },
          select: {
            id: true, businessId: true, status: true, timezone: true,
            prepMinutes: true, cleanupMinutes: true,
            capacity: true, minDurationMinutes: true,
            rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
          },
        });
        if (!locked || locked.status !== "ACTIVE" || locked.businessId !== businessId ||
            !(await tx.bookingUnitOffer.findUnique({
              where: { bookingUnitId_offerId: { bookingUnitId: unit.id, offerId: req.offerId } },
            }))) {
          throw new PartyApiError(409, "Ресурс больше не доступен");
        }
        if (locked.timezone !== "Europe/Minsk") {
          throw new PartyApiError(422, "Для ресурса требуется настройка часового пояса");
        }
        const times = minskBookingWindow(order.eventDate, order.timeFrom, order.timeTo,
          locked.prepMinutes, locked.cleanupMinutes);
        serviceStart = times.serviceStart;
        serviceEnd = times.serviceEnd;
        blockStart = times.blockStart;
        blockEnd = times.blockEnd;
        if ((locked.capacity !== null && (order.childrenCount ?? 0) + (order.adultsCount ?? 0) > locked.capacity) ||
            serviceStart <= now ||
            (locked.minDurationMinutes !== null &&
              serviceEnd.getTime() - serviceStart.getTime() < locked.minDurationMinutes * 60_000)) {
          throw new PartyApiError(422, "Недоступная продолжительность праздника");
        }
        if (quote.serviceStart && quote.serviceStart.getTime() !== serviceStart.getTime() ||
            quote.serviceEnd && quote.serviceEnd.getTime() !== serviceEnd.getTime()) {
          throw new PartyApiError(409, "Время отличается от принятого предложения");
        }

        // PostgreSQL exclusion constraint remains the final line of defense
        // against concurrent bookings through other reservation pathways.
        await tx.$executeRaw`UPDATE "BookingAllocation"
          SET "status" = 'EXPIRED', "updatedAt" = (now() AT TIME ZONE 'UTC')
          WHERE "bookingUnitId" = ${unit.id} AND "status" = 'HELD'
          AND "expiresAt" < (now() AT TIME ZONE 'UTC')`;
        const exceptions = await tx.availabilityException.findMany({
          where: { bookingUnitId: unit.id, date: order.eventDate },
          select: { kind: true, startMinutes: true, endMinutes: true },
        });
        if (!isWithinSchedule(times, locked.rules, exceptions)) {
          throw new PartyApiError(409, "Площадка закрыта в выбранное время");
        }
        const [block, allocation] = await Promise.all([
          tx.calendarBlock.findFirst({
            where: { bookingUnitId: unit.id, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart } },
            select: { id: true },
          }),
          tx.bookingAllocation.findFirst({
            where: { bookingUnitId: unit.id, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart },
              OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } }] },
            select: { id: true },
          }),
        ]);
        if (block || allocation) throw new PartyApiError(409, "Этот ресурс уже занят");
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
      if (unit && serviceStart && serviceEnd && blockStart && blockEnd) {
        await tx.bookingAllocation.create({
          data: { bookingUnitId: unit.id, bookingRequestId: requestId,
            partyQuoteId: quote.id, blockStart, blockEnd, status: "CONFIRMED" },
        });
        await tx.partyQuote.update({
          where: { id: quote.id },
          data: { bookingUnitId: unit.id, serviceStart, serviceEnd },
        });
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
      let addonRequests = 0;
      if (isAnchor) {
        await tx.partyOrderItem.updateMany({
          where: { partyOrderId: order.id, role: PartyItemRole.INCLUDED,
            status: PartyItemStatus.PLANNED },
          data: { status: PartyItemStatus.CONFIRMED },
        });
        const addons = await tx.partyOrderItem.findMany({
          where: { partyOrderId: order.id, role: { in: [PartyItemRole.ADDON, PartyItemRole.STANDALONE] },
            status: PartyItemStatus.PLANNED },
          select: { id: true, offerId: true, businessId: true, note: true },
        });
        if (addons.length) {
          const live = new Map<string, Awaited<ReturnType<typeof verifyPartyOffers>> extends Map<string, infer T> ? T : never>();
          // One discontinued add-on must not roll back a confirmed venue. It
          // remains NEEDS_DECISION so the parent can select a replacement.
          for (const addon of addons) {
            if (!addon.offerId) continue;
            try {
              const checked = await verifyPartyOffers(order.citySlug, [addon.offerId], tx);
              const candidate = checked.get(addon.offerId);
              if (candidate) live.set(addon.offerId, candidate);
            } catch (error) {
              if (!(error instanceof PartyApiError) || error.status !== 422) throw error;
            }
          }
          const due = partyResponseDeadline(now, partyStartAt(order.eventDate, order.timeFrom));
          for (const addon of addons) {
            const published = addon.offerId ? live.get(addon.offerId) : null;
            if (!addon.businessId || !addon.offerId || !published ||
                published.place?.ownerBusinessId !== addon.businessId || due <= now) {
              await tx.partyOrderItem.update({
                where: { id: addon.id }, data: { status: PartyItemStatus.NEEDS_DECISION },
              });
              continue;
            }
            const child = await tx.bookingRequest.create({
              data: {
                kind: BookingKind.PARTY, publicationType: "OFFER",
                userId: order.ownerUserId, businessId: addon.businessId,
                offerId: addon.offerId, partyOrderItemId: addon.id,
                partyStage: "SENT", status: BookingStatus.NEW,
                requestedDate: order.eventDate, requestedTime: order.timeFrom,
                adultsCount: order.adultsCount ?? 0, childrenCount: order.childrenCount ?? 0,
                childAge: order.childAge,
                customerName: null, customerPhone: null, customerComment: null,
                responseDueAt: due,
              },
              select: { id: true },
            });
            await tx.partyOrderItem.update({
              where: { id: addon.id }, data: { status: PartyItemStatus.REQUESTED },
            });
            await tx.bookingActivity.create({
              data: { bookingId: child.id, type: "CREATED", actorType: "SYSTEM",
                payload: { partyOrderId: order.id, afterAnchorConfirmation: requestId } },
            });
            await tx.partyOutbox.create({
              data: { eventType: "PARTY_REQUEST_SENT", aggregateId: child.id,
                dedupeKey: "party:" + child.id + ":sent",
                payload: { partyOrderId: order.id, requestId: child.id, businessId: addon.businessId } },
            });
            addonRequests++;
          }
        }
      }
      return { requestId, confirmed: true, alreadyConfirmed: false, addonRequests };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 });
  } catch (error) {
    if (exclusionViolation(error)) throw new PartyApiError(409, "Этот ресурс только что заняли");
    throw error;
  }
}
