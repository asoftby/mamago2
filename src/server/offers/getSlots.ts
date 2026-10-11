import prisma from "@/lib/prisma";
import { calculateSlots, type GetSlotsInput, type Slot, type SlotSnapshot } from "./slotAvailability";

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

/** Read-only availability preview. A reservation must recheck inside its transaction. */
export async function getSlots(input: GetSlotsInput): Promise<Slot[]> {
  const offer = await prisma.offer.findUnique({
    where: { id: input.offerId },
    select: {
      bookingEnabled: true,
      bookingMode: true,
      openingHoursId: true,
      inheritPlaceOpeningHours: true,
      place: { select: { openingHoursId: true } },
      offerBooking: {
        include: { rules: true, exceptions: true },
      },
    },
  });
  const booking = offer?.offerBooking;
  if (!offer?.bookingEnabled || !booking ||
      (offer.bookingMode !== "USE_PUBLICATION_DATES" && offer.bookingMode !== "USE_PUBLICATION_SLOTS")) return [];

  const openingHoursId = offer.inheritPlaceOpeningHours
    ? offer.place?.openingHoursId
    : offer.openingHoursId;
  const [sessions, requests, links, hours] = await Promise.all([
    prisma.offerSession.findMany({
      where: { offerId: input.offerId, startAt: { lt: input.to }, endAt: { gt: input.from } },
      select: { id: true, startAt: true, endAt: true, capacity: true, isCancelled: true },
    }),
    prisma.bookingRequest.findMany({
      where: { offerId: input.offerId, status: { in: ["NEW", "CONFIRMED"] } },
      select: {
        offerSessionId: true, startsAt: true, seats: true, status: true, holdUntil: true,
        campShiftDateFrom: true, campShiftDateTo: true, childrenCount: true,
      },
    }),
    prisma.bookingUnitOffer.findMany({
      where: { offerId: input.offerId, bookingUnit: { status: "ACTIVE", type: "EXCLUSIVE" } },
      include: {
        bookingUnit: {
          include: {
            rules: true,
            exceptions: true,
            blocks: true,
            allocations: { where: { status: { in: ["HELD", "CONFIRMED"] } } },
          },
        },
      },
    }),
    openingHoursId && booking.scheduleKind === "OPENING_HOURS"
      ? prisma.openingHours.findUnique({
          where: { id: openingHoursId },
          include: { rules: { include: { intervals: true } }, exceptions: { include: { intervals: true } } },
        })
      : Promise.resolve(null),
  ]);

  const snapshot: SlotSnapshot = {
    mode: offer.bookingMode,
    scheduleKind: booking.scheduleKind,
    timezone: booking.timezone,
    leadTimeHours: booking.leadTimeHours,
    horizonDays: booking.horizonDays,
    durationMin: booking.durationMin,
    bufferMin: booking.bufferMin,
    capacity: booking.capacity,
    rules: booking.rules.map((rule) => ({
      weekday: rule.weekday,
      startMinutes: rule.startMinutes,
      endMinutes: rule.endMinutes,
      validFrom: rule.validFrom ? dateKey(rule.validFrom) : null,
      validTo: rule.validTo ? dateKey(rule.validTo) : null,
      capacity: rule.capacity,
    })),
    closedDates: booking.exceptions.map((exception) => dateKey(exception.date)),
    sessions,
    requests: requests.map((request) => ({ ...request, status: request.status as "NEW" | "CONFIRMED" })),
    openingHours: hours ? {
      mode: hours.mode,
      timezone: hours.timezone,
      rules: hours.rules.map((rule) => ({
        dayOfWeek: rule.dayOfWeek,
        isOpen: rule.isOpen,
        allDay: rule.allDay,
        intervals: rule.intervals.map((interval) => ({ startTime: interval.startTime, endTime: interval.endTime })),
      })),
      exceptions: hours.exceptions.map((exception) => ({
        date: exception.date,
        isClosed: exception.isClosed,
        allDay: exception.allDay,
        intervals: exception.intervals.map((interval) => ({ startTime: interval.startTime, endTime: interval.endTime })),
      })),
    } : null,
    units: links.map(({ bookingUnit: unit }) => ({
      id: unit.id,
      timezone: unit.timezone,
      prepMinutes: unit.prepMinutes,
      cleanupMinutes: unit.cleanupMinutes,
      stepMinutes: unit.stepMinutes,
      minDurationMinutes: unit.minDurationMinutes,
      rules: unit.rules.map((rule) => ({
        weekday: rule.weekday, startMinutes: rule.startMinutes, endMinutes: rule.endMinutes,
      })),
      exceptions: unit.exceptions.map((exception) => ({
        date: dateKey(exception.date),
        kind: exception.kind,
        startMinutes: exception.startMinutes,
        endMinutes: exception.endMinutes,
      })),
      blocks: unit.blocks.map((block) => ({ blockStart: block.blockStart, blockEnd: block.blockEnd })),
      allocations: unit.allocations.map((allocation) => ({
        blockStart: allocation.blockStart,
        blockEnd: allocation.blockEnd,
        status: allocation.status as "HELD" | "CONFIRMED",
        expiresAt: allocation.expiresAt,
      })),
    })),
  };
  return calculateSlots(snapshot, input);
}
