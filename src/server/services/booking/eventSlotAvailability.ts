import { BookingMode, BookingStatus, PublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { eventBookingSlotKey, getEventBookingSchedule } from "@/lib/event/eventBookingSchedule";
import { formatHHMM } from "@/lib/formatters/date";
import { calculateEventSeatAvailability, getEventSeatPolicy, type EventSeatPolicy, type EventSeatAvailability } from "@/lib/booking/eventSeatPolicy";
import { getPublicActivityDetailWhere } from "@/server/public/publicContentVisibility";

/** Seats per bookable ActivitySession id. Only slots with a capacity limit are present. */
export type EventSlotAvailability = Record<string, EventSeatAvailability>;

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
  policy?: EventSeatPolicy;
  bookings: readonly ActiveBooking[];
}): EventSlotAvailability {
  const taken = new Map<string, { adults: number; children: number }>();
  for (const booking of input.bookings) {
    const key = bookingSlotKey(booking);
    if (!key) continue;
    const prev = taken.get(key) ?? { adults: 0, children: 0 };
    taken.set(key, { adults: prev.adults + booking.adultsCount, children: prev.children + booking.childrenCount });
  }
  const result: EventSlotAvailability = {};
  for (const session of input.sessions) {
    const key = eventBookingSlotKey(getLocalDateKey(session.startsAt), formatHHMM(session.startsAt));
    const capacity = input.configured.get(key)?.capacity ?? input.fallbackCapacity ?? undefined;
    const used = taken.get(key) ?? { adults: 0, children: 0 };
    const availability = calculateEventSeatAvailability({
      policy: input.policy ?? getEventSeatPolicy(null), capacity,
      usedAdults: used.adults, usedChildren: used.children,
    });
    if (availability) result[session.id] = availability;
  }
  return result;
}

/** Two indexed reads (sessions, active bookings); null when the event is not bookable by time. */
export async function getEventSlotAvailability(activityId: string): Promise<EventSlotAvailability | null> {
  const now = new Date();
  const activity = await prisma.activity.findFirst({
    where: {
      ...getPublicActivityDetailWhere(), id: activityId, type: "EVENT", bookingEnabled: true,
      bookingMode: { in: [BookingMode.USE_PUBLICATION_SLOTS, BookingMode.USE_PUBLICATION_DATES] },
    },
    select: { id: true, scheduleJson: true, bookingMode: true, bookingCapacityPerSlot: true },
  });
  if (!activity) return null;
  // Date-only calendar: the modal identifies days by YYYY-MM-DD rather than
  // ActivitySession ids. Count active bookings for each configured date.
  if (activity.bookingMode === BookingMode.USE_PUBLICATION_DATES) {
    const configured = getEventBookingSchedule(activity.scheduleJson, activity.bookingMode);
    const days = [...configured.values()].filter((slot) => !slot.startTime && slot.date >= getLocalDateKey(now));
    if (days.length === 0) return {};
    const bookings = await prisma.bookingRequest.findMany({
      where: {
        activityId, publicationType: PublicationType.EVENT,
        status: { in: [BookingStatus.NEW, BookingStatus.CONFIRMED] },
        selectedSessionId: null,
        requestedDate: { in: days.map((slot) => new Date(slot.date)) },
        requestedTime: null,
      },
      select: { requestedDate: true, adultsCount: true, childrenCount: true },
    });
    const counts = new Map<string, { adults: number; children: number }>();
    for (const booking of bookings) {
      const key = booking.requestedDate?.toISOString().slice(0, 10);
      if (!key) continue;
      const used = counts.get(key) ?? { adults: 0, children: 0 };
      used.adults += booking.adultsCount;
      used.children += booking.childrenCount;
      counts.set(key, used);
    }
    const policy = getEventSeatPolicy(activity.scheduleJson);
    const result: EventSlotAvailability = {};
    for (const slot of days) {
      const used = counts.get(slot.date) ?? { adults: 0, children: 0 };
      const availability = calculateEventSeatAvailability({
        policy, capacity: slot.capacity ?? activity.bookingCapacityPerSlot,
        usedAdults: used.adults, usedChildren: used.children,
      });
      if (availability) result[slot.date] = availability;
    }
    return result;
  }
  // First resolve available sessions, then scope active requests to them.
  // A request may have a selectedSessionId but no requestedDate.
  const sessions = await prisma.activitySession.findMany({
    where: { activityId: activity.id, withdrawnAt: null, startsAt: { gt: now }, OR: [{ isSaleOpen: null }, { isSaleOpen: true }] },
    select: { id: true, startsAt: true },
  });
  const bookings = await prisma.bookingRequest.findMany({
      where: {
        activityId: activity.id,
        publicationType: PublicationType.EVENT,
        status: { in: [BookingStatus.NEW, BookingStatus.CONFIRMED] },
        // Include session-linked bookings without requestedDate. Date-only
        // filtering previously over-reported free seats for those requests.
        OR: [
          { selectedSessionId: { in: sessions.map((session) => session.id) } },
          { requestedDate: { gte: new Date(getLocalDateKey(now)) } },
        ],
      },
      select: { adultsCount: true, childrenCount: true, requestedDate: true, requestedTime: true, session: { select: { startsAt: true } } },
  });
  return computeEventSlotAvailability({
    sessions,
    configured: getEventBookingSchedule(activity.scheduleJson, activity.bookingMode),
    fallbackCapacity: activity.bookingCapacityPerSlot ?? null,
    policy: getEventSeatPolicy(activity.scheduleJson),
    bookings,
  });
}
