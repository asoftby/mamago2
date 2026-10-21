import "server-only";
import { BookingKind, BookingStatus, PartyItemRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PartyApiError, partyStartAt } from "./partyDraft.validation";
import { isWithinSchedule, minskBookingWindow } from "./partyConfirmationAvailability";

/**
 * Privacy-safe PREVIEW. Only final confirmPartyRequest() can reserve a room,
 * after locking rows and recomputing availability in the write transaction.
 */
export async function listPartyConfirmChoices(businessId: string, requestId: string) {
  const request = await prisma.bookingRequest.findFirst({
    where: { id: requestId, businessId, kind: BookingKind.PARTY,
      partyStage: "AWAITING_RECONFIRM", status: BookingStatus.NEW },
    select: {
      offerId: true, responseDueAt: true, partyOrderItem: {
        select: {
          role: true, partyOrder: { select: {
            venueMode: true, eventDate: true, timeFrom: true, timeTo: true,
            adultsCount: true, childrenCount: true,
          } },
        },
      },
      partyQuotes: { orderBy: { version: "desc" }, take: 1,
        select: { version: true, status: true, bookingUnitId: true,
          serviceStart: true, serviceEnd: true } },
    },
  });
  const order = request?.partyOrderItem?.partyOrder;
  const quote = request?.partyQuotes[0];
  if (!request?.offerId || !order || !quote || quote.status !== "ACCEPTED" ||
      !order.eventDate || !order.timeFrom || !order.timeTo) {
    throw new PartyApiError(404, "Заявка для подтверждения не найдена");
  }

  const requireUnit = request.partyOrderItem?.role === PartyItemRole.ANCHOR &&
    (order.venueMode === "VENUE" || order.venueMode === "PACKAGE");
  const mapped = await prisma.bookingUnitOffer.findMany({
    where: { offerId: request.offerId },
    select: { bookingUnit: {
      select: {
        id: true, name: true, businessId: true, status: true, timezone: true,
        capacity: true, prepMinutes: true, cleanupMinutes: true,
        minDurationMinutes: true,
        rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
      },
    } },
  });
  const now = new Date();
  const candidates = [];
  if (request.responseDueAt && request.responseDueAt > now &&
      partyStartAt(order.eventDate, order.timeFrom) > now) {
    for (const { bookingUnit: unit } of mapped) {
      if (unit.businessId !== businessId || unit.status !== "ACTIVE" ||
          unit.timezone !== "Europe/Minsk" ||
          (quote.bookingUnitId && quote.bookingUnitId !== unit.id) ||
          (unit.capacity !== null &&
            (order.adultsCount ?? 0) + (order.childrenCount ?? 0) > unit.capacity)) {
        continue;
      }
      const window = minskBookingWindow(order.eventDate, order.timeFrom, order.timeTo,
        unit.prepMinutes, unit.cleanupMinutes);
      if (unit.minDurationMinutes !== null &&
          window.serviceEnd.getTime() - window.serviceStart.getTime() <
            unit.minDurationMinutes * 60_000) continue;
      if (quote.serviceStart && quote.serviceStart.getTime() !== window.serviceStart.getTime() ||
          quote.serviceEnd && quote.serviceEnd.getTime() !== window.serviceEnd.getTime()) continue;
      const [exceptions, blocked, reserved] = await Promise.all([
        prisma.availabilityException.findMany({
          where: { bookingUnitId: unit.id, date: order.eventDate },
          select: { kind: true, startMinutes: true, endMinutes: true },
        }),
        prisma.calendarBlock.findFirst({
          where: { bookingUnitId: unit.id,
            blockStart: { lt: window.blockEnd }, blockEnd: { gt: window.blockStart } },
          select: { id: true },
        }),
        prisma.bookingAllocation.findFirst({
          where: { bookingUnitId: unit.id,
            blockStart: { lt: window.blockEnd }, blockEnd: { gt: window.blockStart },
            OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } }] },
          select: { id: true },
        }),
      ]);
      if (blocked || reserved || !isWithinSchedule(window, unit.rules, exceptions)) continue;
      candidates.push({ id: unit.id, name: unit.name, capacity: unit.capacity });
    }
  }
  return {
    requestId,
    quoteVersion: quote.version,
    requireUnit,
    manualAllowed: !requireUnit && mapped.length === 0,
    units: candidates,
  };
}
