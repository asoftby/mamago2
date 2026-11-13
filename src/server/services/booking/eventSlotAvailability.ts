import { BookingMode, BookingStatus, PublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { eventBookingSlotKey, getEventBookingSchedule } from "@/lib/event/eventBookingSchedule";
import { formatHHMM } from "@/lib/formatters/date";
import { getPublicActivityDetailWhere } from "@/server/public/publicContentVisibility";

/** Seats per bookable ActivitySession id. Only slots with a capacity limit are present. */
export type EventSlotAvailability = Record<string, { capacity: number; remaining: number }>;

type ActiveBooking = {
  adultsCount: number;
  childrenCount: number;
  session: { startsAt: Date } | null;
  requestedDate: Date | null;
  requestedTime: string | null;
};

function bookingSlotKey(booking: ActiveBooking): string | null {
  if (booking.session) {
    return eventBookingSlotKey(getLocalDateKey(booking.session.startsAt), formatHHMM(booking.session.startsAt));
  }
  if (booking.requestedDate && booking.requestedTime) {
    return eventBookingSlotKey(booking.requestedDate.toISOString().slice(0, 10), booking.requestedTime);
  }
  return null;
}

/**
 * Pure seat arithmetic, mirroring the capacity check in booking.service (createEvent):
 * every NEW/CONFIRMED request holds adults + children seats of its slot.
 */
export function computeEventSlotAvailability(input: {
  sessions: readonly { id: string; startsAt: Date }[];
  configured: ReturnType<typeof getEventBookingSchedule>;
  fallbackCapacity: number | null;
  bookings: readonly ActiveBooking[];
}): EventSlotAvailability {
  const taken = new Map<string, number>();
  for (const booking of input.bookings) {
    const key = bookingSlotKey(booking);
    if (key) taken.set(key, (taken.get(key) ?? 0) + booking.adultsCount + booking.childrenCount);
  }
  const result: EventSlotAvailability = {};
  for (const session of input.sessions) {
    const key = eventBookingSlotKey(getLocalDateKey(session.startsAt), formatHHMM(session.startsAt));
    const capacity = input.configured.get(key)?.capacity ?? input.fallbackCapacity ?? undefined;
    if (capacity === undefined) continue;
    result[session.id] = { capacity, remaining: Math.max(0, capacity - (taken.get(key) ?? 0)) };
  }
  return result;
}

/** Two indexed reads (sessions, active bookings); null when the event is not bookable by time. */
export async function getEventSlotAvailability(activityId: string): Promise<EventSlotAvailability | null> {
  const now = new Date();
  const activity = await prisma.activity.findFirst({
    where: { ...getPublicActivityDetailWhere(), id: activityId, type: "EVENT", bookingEnabled: true, bookingMode: BookingMode.USE_PUBLICATION_SLOTS },
    select: { id: true, scheduleJson: true, bookingMode: true, bookingCapacityPerSlot: true },
  });
  if (!activity) return null;
  const [sessions, bookings] = await Promise.all([
    prisma.activitySession.findMany({
      where: { activityId: activity.id, withdrawnAt: null, startsAt: { gt: now }, OR: [{ isSaleOpen: null }, { isSaleOpen: true }] },
      select: { id: true, startsAt: true },
    }),
    prisma.bookingRequest.findMany({
      where: {
        activityId: activity.id,
        publicationType: PublicationType.EVENT,
        status: { in: [BookingStatus.NEW, BookingStatus.CONFIRMED] },
        requestedDate: { gte: new Date(getLocalDateKey(now)) },
      },
      select: { adultsCount: true, childrenCount: true, requestedDate: true, requestedTime: true, session: { select: { startsAt: true } } },
    }),
  ]);
  return computeEventSlotAvailability({
    sessions,
    configured: getEventBookingSchedule(activity.scheduleJson, activity.bookingMode),
    fallbackCapacity: activity.bookingCapacityPerSlot ?? null,
    bookings,
  });
}
