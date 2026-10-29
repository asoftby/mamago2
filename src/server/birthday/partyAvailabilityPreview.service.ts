import "server-only";
import prisma from "@/lib/prisma";
import { minskBookingWindow, isWithinSchedule } from "./partyConfirmationAvailability";
import { overlapsBookingWindow } from "./partyAvailabilityPreview.logic";

/** Informational only. Final booking always locks and rechecks in lockAvailablePartyUnit. */
export async function previewPartyOfferAvailability(input: {
  offerId: string; date: string; timeFrom: string; timeTo: string;
  childrenCount: number; adultsCount: number;
}) {
  const date = new Date(input.date + "T00:00:00.000Z");
  const offer = await prisma.offer.findFirst({
    where: { id: input.offerId, status: "PUBLISHED" },
    select: { id: true, place: { select: { ownerBusinessId: true } } },
  });
  const businessId = offer?.place?.ownerBusinessId;
  if (!businessId) return { availability: "UNKNOWN" as const };
  const mapped = await prisma.bookingUnitOffer.findMany({
    where: { offerId: input.offerId, bookingUnit: { businessId } },
    select: { bookingUnit: { select: {
      id: true, status: true, timezone: true, capacity: true,
      prepMinutes: true, cleanupMinutes: true, minDurationMinutes: true,
      rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
    } } },
  });
  if (mapped.length === 0) return { availability: "UNKNOWN" as const };
  const now = new Date();
  const eligible = [];
  for (const { bookingUnit: unit } of mapped) {
    if (unit.status !== "ACTIVE" || unit.timezone !== "Europe/Minsk" ||
      (unit.capacity !== null && input.childrenCount + input.adultsCount > unit.capacity)) continue;
    const window = minskBookingWindow(date, input.timeFrom, input.timeTo, unit.prepMinutes, unit.cleanupMinutes);
    if (window.serviceStart <= now ||
      (unit.minDurationMinutes !== null &&
        (window.serviceEnd.getTime() - window.serviceStart.getTime()) / 60000 < unit.minDurationMinutes)) continue;
    eligible.push({ unit, window });
  }
  if (eligible.length === 0) return { availability: "UNAVAILABLE" as const };

  // One bounded batch per relation, instead of three queries per booking unit.
  // Apply the exact per-unit overlap in memory after the broad DB range filter.
  const ids = [...new Set(eligible.map(({ unit }) => unit.id))];
  const blockStart = new Date(Math.min(...eligible.map(({ window }) => window.blockStart.getTime())));
  const blockEnd = new Date(Math.max(...eligible.map(({ window }) => window.blockEnd.getTime())));
  const [exceptions, blocks, allocations] = await Promise.all([
    prisma.availabilityException.findMany({
      where: { bookingUnitId: { in: ids }, date },
      select: { bookingUnitId: true, kind: true, startMinutes: true, endMinutes: true },
    }),
    prisma.calendarBlock.findMany({
      where: { bookingUnitId: { in: ids }, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart } },
      select: { bookingUnitId: true, blockStart: true, blockEnd: true },
    }),
    prisma.bookingAllocation.findMany({
      where: {
        bookingUnitId: { in: ids }, blockStart: { lt: blockEnd }, blockEnd: { gt: blockStart },
        OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } }],
      },
      select: { bookingUnitId: true, blockStart: true, blockEnd: true },
    }),
  ]);
  for (const { unit, window } of eligible) {
    const blocked = blocks.some((item) => item.bookingUnitId === unit.id && overlapsBookingWindow(item, window));
    const reserved = allocations.some((item) => item.bookingUnitId === unit.id && overlapsBookingWindow(item, window));
    if (!blocked && !reserved && isWithinSchedule(
      window, unit.rules, exceptions.filter((item) => item.bookingUnitId === unit.id),
    )) return { availability: "AVAILABLE" as const };
  }
  return { availability: "UNAVAILABLE" as const };
}
