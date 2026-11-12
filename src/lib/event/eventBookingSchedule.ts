import { isLocalDateString } from "./expandScheduleItemDates";

type EventBookingSlotConfig = {
  date: string;
  startTime: string;
  endTime?: string;
  capacity?: number;
};

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value);
}

export function eventBookingSlotKey(date: string, time: string): string {
  return `${date}|${time}`;
}

/** Wizard IDs identify editor rows. Public bookings use the matching ActivitySession ID. */
export function getEventBookingSchedule(
  value: unknown,
  bookingMode?: string | null,
): Map<string, EventBookingSlotConfig> {
  const schedule = record(value);
  const slots = new Map<string, EventBookingSlotConfig>();

  function add(date: unknown, startTime: unknown, endTime: unknown, capacity: unknown) {
    if (!isLocalDateString(date) || (startTime !== "" && !validTime(startTime))) return;
    const calendarDate = new Date(date);
    if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== date) return;
    const key = eventBookingSlotKey(date, startTime);
    const previousCapacity = slots.get(key)?.capacity ?? Infinity;
    const limit = typeof capacity === "number" && Number.isSafeInteger(capacity) && capacity >= 0
      ? Math.min(capacity, previousCapacity) : previousCapacity;
    slots.set(key, {
      date,
      startTime,
      endTime: startTime && validTime(endTime) && endTime > startTime ? endTime : undefined,
      capacity: Number.isFinite(limit) ? limit : undefined,
    });
  }

  if (schedule.participationMode === "simple-booking") {
    const [start, end] = typeof schedule.simpleBookingTime === "string"
      ? schedule.simpleBookingTime.split(/[-–]/).map((time) => time.trim()) : [];
    add(schedule.simpleBookingDate, start || "", end, schedule.simpleBookingCapacity);
  }
  // The legacy booking wizard may persist an enabled calendar with a null
  // participationMode (or a "walk-in" compatibility fallback). Only honor
  // this path when the booking columns explicitly enable scheduled booking.
  // An explicit DISCOVER/walk-in draft must never create a booking CTA.
  const draft = record(schedule.ctaStepDraft);
  const legacyCalendar =
    (bookingMode === "USE_PUBLICATION_DATES" || bookingMode === "USE_PUBLICATION_SLOTS") &&
    (schedule.participationMode == null ||
      (schedule.participationMode === "walk-in" &&
        draft.legacyOrigin === "BOOKING" &&
        draft.actionChoice === "REQUEST" &&
        draft.requestMode === "CALENDAR"));
  if (schedule.participationMode === "time-slots" || legacyCalendar) {
    const dates = record(schedule.timeSlots).dates;
    for (const entry of Array.isArray(dates) ? dates : []) {
      const day = record(entry);
      for (const item of Array.isArray(day.slots) ? day.slots : []) {
        const slot = record(item);
        add(day.isoDate, slot.startTime, slot.endTime, slot.capacity);
      }
    }
  }
  return slots;
}
