import "server-only";
import prisma from "@/lib/prisma";
import { minskBookingWindow, isWithinSchedule } from "./partyConfirmationAvailability";

/** Informational only. Final booking always locks and rechecks in lockAvailablePartyUnit. */
export async function previewPartyOfferAvailability(input: {
  offerId: string; date: string; timeFrom: string; timeTo: string;
  childrenCount: number; adultsCount: number;
}) {
  const date = new Date(input.date + "T00:00:00.000Z");
  const offer = await prisma.offer.findFirst({
    where: { id: input.offerId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!offer) return { availability: "UNKNOWN" as const };
  const mapped = await prisma.bookingUnitOffer.findMany({
    where: { offerId: input.offerId },
    select: { bookingUnit: { select: {
      id: true, status: true, timezone: true, capacity: true,
      prepMinutes: true, cleanupMinutes: true, minDurationMinutes: true,
      rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
    } } },
  });
  if (mapped.length === 0) return { availability: "UNKNOWN" as const };
  const now = new Date();
  for (const { bookingUnit: unit } of mapped) {
    if (unit.status !== "ACTIVE" || unit.timezone !== "Europe/Minsk" ||
      (unit.capacity !== null && input.childrenCount + input.adultsCount > unit.capacity)) continue;
    const window = minskBookingWindow(date, input.timeFrom, input.timeTo, unit.prepMinutes, unit.cleanupMinutes);
    if (window.serviceStart <= now ||
      (unit.minDurationMinutes !== null &&
        (window.serviceEnd.getTime() - window.serviceStart.getTime()) / 60000 < unit.minDurationMinutes)) continue;
    const [exceptions, blocked, reserved] = await Promise.all([
      prisma.availabilityException.findMany({
        where: { bookingUnitId: unit.id, date },
        select: { kind: true, startMinutes: true, endMinutes: true },
      }),
      prisma.calendarBlock.findFirst({
        where: { bookingUnitId: unit.id, blockStart: { lt: window.blockEnd }, blockEnd: { gt: window.blockStart } },
        select: { id: true },
      }),
      prisma.bookingAllocation.findFirst({
        where: { bookingUnitId: unit.id, blockStart: { lt: window.blockEnd }, blockEnd: { gt: window.blockStart },
          OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } }] },
        select: { id: true },
      }),
    ]);
    if (!blocked && !reserved && isWithinSchedule(window, unit.rules, exceptions))
      return { availability: "AVAILABLE" as const };
  }
  return { availability: "UNAVAILABLE" as const };
}
