/**
 * Canonical business roster scope for one occurrence. It must mirror
 * createPublicationBooking's slot matching, including same-time session
 * aliases, otherwise organizer headcounts can understate occupied capacity.
 */
import { BookingKind, BookingMode, BookingStatus, PublicationType, type Prisma } from "@prisma/client";
import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";
import { resolveBookingServiceEnd } from "@/lib/booking/effectiveServiceEnd";

export function eventRosterWhere(input: {
  businessId: string;
  activityId: string;
  sessionStartsAt: Date;
  bookingMode: BookingMode | null;
}): Prisma.BookingRequestWhereInput {
  const dateKey = getLocalDateKey(input.sessionStartsAt);
  const time = formatHHMM(input.sessionStartsAt);
  const dayOnly = input.bookingMode === BookingMode.USE_PUBLICATION_DATES;
  const start = dayOnly ? localWallClockToUtc(dateKey, "00:00") : localWallClockToUtc(dateKey, time);
  const end = dayOnly
    ? localWallClockToUtc(addDaysLocal(dateKey, 1), "00:00")
    : new Date(start.getTime() + 60_000);
  return {
    businessId: input.businessId,
    activityId: input.activityId,
    publicationType: PublicationType.EVENT,
    kind: BookingKind.STANDARD,
    status: { in: [BookingStatus.NEW, BookingStatus.CONFIRMED] },
    OR: [
      { session: { startsAt: { gte: start, lt: end } } },
      dayOnly
        ? { selectedSessionId: null, requestedDate: new Date(dateKey), requestedTime: null }
        : { requestedDate: new Date(dateKey), requestedTime: time },
    ],
  };
}

/**
 * Bulk attendee identities (never phone/email) are accessible only on the
 * occurrence's Minsk calendar day for check-in, not as a future CRM export.
 * Individual order contact disclosure uses its existing audited endpoint.
 */
export function canShowEventRosterNames(input: {
  now: Date;
  sessionStartsAt: Date;
}): boolean {
  const dateKey = getLocalDateKey(input.sessionStartsAt);
  const effectiveEnd = resolveBookingServiceEnd({ requestedDate: new Date(dateKey) });
  return getLocalDateKey(input.now) === dateKey &&
    effectiveEnd !== null &&
    effectiveEnd.getTime() > input.now.getTime();
}
