import "server-only";
import type { Prisma } from "@prisma/client";
import { expireBookingUnitHolds, lockBookingUnits } from "@/server/services/booking/resourceAllocation";
import { PartyApiError } from "./partyDraft.validation";
import { isWithinSchedule, minskBookingWindow } from "./partyConfirmationAvailability";

export type PartyUnitWindow = {
  serviceStart: Date; serviceEnd: Date; blockStart: Date; blockEnd: Date;
};

/**
 * Locks an exclusive resource (room or performer) and proves it is free for the party:
 * active, owned by the business, linked to the offer, open by schedule, not blocked and
 * without a live allocation overlapping the service time widened by prep/cleanup.
 * Shared by the business confirmation and the fixed-price auto-confirmation.
 */
export async function lockAvailablePartyUnit(tx: Prisma.TransactionClient, params: {
  unitId: string;
  businessId: string;
  offerId: string;
  order: {
    eventDate: Date; timeFrom: string; timeTo: string;
    childrenCount: number | null; adultsCount: number | null;
  };
  now: Date;
}): Promise<PartyUnitWindow> {
  const { unitId, businessId, offerId, order, now } = params;
  // Lock the canonical resource *before* reading availability; a stale
  // preflight snapshot must not authorize a room just disabled by admin.
  if (!await lockBookingUnits(tx, businessId, [unitId])) {
    throw new PartyApiError(409, "Ресурс больше не доступен");
  }
  const checkedAt = new Date(Math.max(now.getTime(), Date.now()));
  const locked = await tx.bookingUnit.findUnique({
    where: { id: unitId },
    select: {
      id: true, businessId: true, status: true, timezone: true,
      prepMinutes: true, cleanupMinutes: true,
      capacity: true, minDurationMinutes: true,
      rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
    },
  });
  if (!locked || locked.status !== "ACTIVE" || locked.businessId !== businessId ||
      !(await tx.bookingUnitOffer.findUnique({
        where: { bookingUnitId_offerId: { bookingUnitId: unitId, offerId } },
      }))) {
    throw new PartyApiError(409, "Ресурс больше не доступен");
  }
  if (locked.timezone !== "Europe/Minsk") {
    throw new PartyApiError(422, "Для ресурса требуется настройка часового пояса");
  }
  const times = minskBookingWindow(order.eventDate, order.timeFrom, order.timeTo,
    locked.prepMinutes, locked.cleanupMinutes);
  const { serviceStart, serviceEnd, blockStart, blockEnd } = times;
  if ((locked.capacity !== null && (order.childrenCount ?? 0) + (order.adultsCount ?? 0) > locked.capacity) ||
      serviceStart <= checkedAt ||
      (locked.minDurationMinutes !== null &&
        serviceEnd.getTime() - serviceStart.getTime() < locked.minDurationMinutes * 60_000)) {
    throw new PartyApiError(422, "Недоступная продолжительность праздника");
  }

  await expireBookingUnitHolds(tx, [unitId]);
  const exceptions = await tx.availabilityException.findMany({
    where: { bookingUnitId: unitId, date: order.eventDate },
    select: { kind: true, startMinutes: true, endMinutes: true },
  });
  if (!isWithinSchedule(times, locked.rules, exceptions)) {
    throw new PartyApiError(409, "Площадка закрыта в выбранное время");
  }
  const [block, allocation] = await Promise.all([
    tx.calendarBlock.findFirst({
      where: { bookingUnitId: unitId, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart } },
      select: { id: true },
    }),
    tx.bookingAllocation.findFirst({
      where: { bookingUnitId: unitId, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart },
        OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: checkedAt } }] },
      select: { id: true },
    }),
  ]);
  if (block || allocation) throw new PartyApiError(409, "Этот ресурс уже занят");
  return { serviceStart, serviceEnd, blockStart, blockEnd };
}

/** Records the confirmed occupancy and pins it on the accepted quote. */
export async function allocatePartyUnit(tx: Prisma.TransactionClient, params: {
  unitId: string; requestId: string; quoteId: string; window: PartyUnitWindow;
}) {
  const { unitId, requestId, quoteId, window } = params;
  await tx.bookingAllocation.create({
    data: { bookingUnitId: unitId, bookingRequestId: requestId,
      partyQuoteId: quoteId, blockStart: window.blockStart, blockEnd: window.blockEnd,
      status: "CONFIRMED" },
  });
  await tx.partyQuote.update({
    where: { id: quoteId },
    data: { bookingUnitId: unitId, serviceStart: window.serviceStart, serviceEnd: window.serviceEnd },
  });
}
