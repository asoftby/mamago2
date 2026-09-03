/**
 * Opening Hours Service
 * Business logic for calculating opening hours status
 */

import type { PrismaClient, Place, Offer } from "../../types";
import {
  type OpeningHoursWithRelations,
  type OpeningHoursScheduleLike,
  type OpeningStatus,
  type TimeInterval,
  JS_DAY_TO_DAY_OF_WEEK,
} from "./openingHours.types";
import {
  formatDateInTimezone,
  getTimeStringInTimezone,
  getDayOfWeekInTimezone,
  isTimeInInterval,
  compareTime,
} from "./openingHours.utils";

/**
 * Get effective opening hours for a place/offer
 * Handles inheritance for offers
 *
 * @param prisma - Prisma client
 * @param place - Place entity
 * @param offer - Optional offer entity
 * @returns OpeningHours with relations or null
 */
export async function getEffectiveOpeningHours(
  prisma: PrismaClient,
  place: Place,
  offer?: Offer
): Promise<OpeningHoursWithRelations | null> {
  // If offer provided and not inheriting, use offer's hours
  if (offer && !offer.inheritPlaceOpeningHours && offer.openingHoursId) {
    const offerHours = await prisma.openingHours.findUnique({
      where: { id: offer.openingHoursId },
      include: {
        rules: {
          include: {
            intervals: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        exceptions: {
          include: {
            intervals: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });
    return offerHours;
  }

  // Otherwise use place's hours
  if (place.openingHoursId) {
    const placeHours = await prisma.openingHours.findUnique({
      where: { id: place.openingHoursId },
      include: {
        rules: {
          include: {
            intervals: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        exceptions: {
          include: {
            intervals: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });
    return placeHours;
  }

  return null;
}

/**
 * Get today's opening intervals
 * Considers exceptions and weekly rules
 *
 * @param openingHours - Opening hours with relations
 * @param now - Current date/time
 * @returns Array of time intervals for today
 */
export function getTodayIntervals(
  openingHours: OpeningHoursScheduleLike,
  now: Date
): TimeInterval[] {
  const timezone = openingHours.timezone;
  const todayDate = formatDateInTimezone(now, timezone);
  const dayOfWeek = getDayOfWeekInTimezone(now, timezone);
  const dayOfWeekEnum = JS_DAY_TO_DAY_OF_WEEK[dayOfWeek as keyof typeof JS_DAY_TO_DAY_OF_WEEK];

  // Check for exception on this date
  const exception = openingHours.exceptions.find((ex: { date: string }) => ex.date === todayDate);

  if (exception) {
    // Exception overrides weekly rules
    if (exception.isClosed) {
      return []; // Closed for the day
    }

    if (exception.allDay) {
      return [{ startTime: "00:00", endTime: "23:59" }];
    }

    // Return exception intervals
    return exception.intervals.map((interval: { startTime: string; endTime: string }) => ({
      startTime: interval.startTime,
      endTime: interval.endTime,
    }));
  }

  // No exception, use weekly rule
  const rule = openingHours.rules.find((r: { dayOfWeek: string }) => r.dayOfWeek === dayOfWeekEnum);

  if (!rule || !rule.isOpen) {
    return []; // Closed for the day
  }

  if (rule.allDay) {
    return [{ startTime: "00:00", endTime: "23:59" }];
  }

  // Return rule intervals
  return rule.intervals.map((interval: { startTime: string; endTime: string }) => ({
    startTime: interval.startTime,
    endTime: interval.endTime,
  }));
}

/**
 * Check if currently open
 *
 * @param openingHours - Opening hours with relations
 * @param now - Current date/time
 * @returns True if open now
 */
export function isOpenNow(
  openingHours: OpeningHoursScheduleLike,
  now: Date
): boolean {
  const mode = openingHours.mode;

  // Handle special modes
  if (mode === "ALWAYS_OPEN") {
    return true;
  }

  if (mode === "BY_APPOINTMENT" || mode === "TEMPORARILY_CLOSED") {
    return false;
  }

  // WEEKLY mode: check intervals
  const intervals = getTodayIntervals(openingHours, now);

  if (intervals.length === 0) {
    return false; // No intervals = closed
  }

  const timezone = openingHours.timezone;
  const currentTime = getTimeStringInTimezone(now, timezone);

  // Check if current time falls in any interval
  return intervals.some((interval) =>
    isTimeInInterval(currentTime, interval.startTime, interval.endTime)
  );
}

/**
 * Get next opening time if currently closed
 *
 * @param openingHours - Opening hours with relations
 * @param now - Current date/time
 * @returns Next opening time or null if not applicable
 */
export function getNextOpeningTime(
  openingHours: OpeningHoursScheduleLike,
  now: Date
): Date | null {
  const mode = openingHours.mode;

  // Special modes don't have "next opening"
  if (mode === "ALWAYS_OPEN" || mode === "BY_APPOINTMENT" || mode === "TEMPORARILY_CLOSED") {
    return null;
  }

  // If currently open, no "next opening"
  if (isOpenNow(openingHours, now)) {
    return null;
  }

  const timezone = openingHours.timezone;
  const currentTime = getTimeStringInTimezone(now, timezone);
  const intervals = getTodayIntervals(openingHours, now);

  // Check if there's a later interval today
  for (const interval of intervals) {
    const cmp = compareTime(currentTime, interval.startTime);
    if (cmp !== null && cmp < 0) {
      // Found an interval that starts later today
      const [hours, minutes] = interval.startTime.split(":").map(Number);
      const nextOpening = new Date(now);
      nextOpening.setHours(hours, minutes, 0, 0);
      return nextOpening;
    }
  }

  // No more intervals today, check next 7 days
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const futureIntervals = getTodayIntervals(openingHours, futureDate);

    if (futureIntervals.length > 0) {
      // Found a day with intervals
      const firstInterval = futureIntervals[0];
      const [hours, minutes] = firstInterval.startTime.split(":").map(Number);
      const nextOpening = new Date(futureDate);
      nextOpening.setHours(hours, minutes, 0, 0);
      return nextOpening;
    }
  }

  // No opening found in next 7 days
  return null;
}

/**
 * Get detailed opening status with message
 *
 * @param openingHours - Opening hours with relations
 * @param now - Current date/time
 * @returns Opening status with human-readable message
 */
export function getOpeningStatus(
  openingHours: OpeningHoursScheduleLike,
  now: Date
): OpeningStatus {
  const mode = openingHours.mode;

  // Handle ALWAYS_OPEN
  if (mode === "ALWAYS_OPEN") {
    return {
      isOpen: true,
      status: "always_open",
      message: "Круглосуточно",
    };
  }

  // Handle BY_APPOINTMENT
  if (mode === "BY_APPOINTMENT") {
    return {
      isOpen: false,
      status: "by_appointment",
      message: "По записи",
    };
  }

  // Handle TEMPORARILY_CLOSED
  if (mode === "TEMPORARILY_CLOSED") {
    const note = openingHours.note || "Временно закрыто";
    return {
      isOpen: false,
      status: "temporarily_closed",
      message: note,
    };
  }

  // WEEKLY mode
  const isOpen = isOpenNow(openingHours, now);
  const timezone = openingHours.timezone;
  const intervals = getTodayIntervals(openingHours, now);

  if (isOpen) {
    // Find when closes
    const currentTime = getTimeStringInTimezone(now, timezone);
    let closingTime: string | null = null;

    for (const interval of intervals) {
      if (isTimeInInterval(currentTime, interval.startTime, interval.endTime)) {
        closingTime = interval.endTime;
        break;
      }
    }

    if (closingTime) {
      return {
        isOpen: true,
        status: "open",
        message: `Открыто до ${closingTime}`,
        todayIntervals: intervals,
      };
    }

    return {
      isOpen: true,
      status: "open",
      message: "Открыто",
      todayIntervals: intervals,
    };
  }

  // Currently closed
  const nextOpening = getNextOpeningTime(openingHours, now);

  if (nextOpening) {
    const nextOpeningTime = getTimeStringInTimezone(nextOpening, timezone);
    const nextOpeningDate = formatDateInTimezone(nextOpening, timezone);
    const todayDate = formatDateInTimezone(now, timezone);

    if (nextOpeningDate === todayDate) {
      // Opens later today
      return {
        isOpen: false,
        status: "closed",
        message: `Сейчас закрыто • Откроется в ${nextOpeningTime}`,
        nextChange: nextOpening,
        todayIntervals: intervals,
      };
    }

    // Opens on a future day
    return {
      isOpen: false,
      status: "closed",
      message: "Сейчас закрыто",
      nextChange: nextOpening,
      todayIntervals: intervals,
    };
  }

  // No next opening found
  return {
    isOpen: false,
    status: "closed",
    message: "Сейчас закрыто",
    todayIntervals: intervals,
  };
}
