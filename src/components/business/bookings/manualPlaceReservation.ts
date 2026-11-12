import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";

const MINUTE_MS = 60_000;

export type ManualPlaceReservation = {
  resourceReservation: { bookingUnitId: string; startsAt: string; endsAt: string };
  blockStart: Date;
  blockEnd: Date;
};

/**
 * Timezone-safe display/intent preview only. The booking backend revalidates
 * every resource, interval and overlap under a PostgreSQL transaction.
 */
export function buildManualPlaceReservation(input: {
  bookingUnitId: string;
  date: string;
  time: string;
  timezone: string;
  durationMinutes: number;
  prepMinutes: number;
  cleanupMinutes: number;
}): ManualPlaceReservation | null {
  const { bookingUnitId, date, time, timezone, durationMinutes, prepMinutes, cleanupMinutes } = input;
  if (!bookingUnitId || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440 ||
      !Number.isInteger(prepMinutes) || prepMinutes < 0 ||
      !Number.isInteger(cleanupMinutes) || cleanupMinutes < 0) return null;
  try {
    const start = localWallClockToUtc(date, time, timezone);
    if (!Number.isFinite(start.getTime()) ||
        getLocalDateKey(start, timezone) !== date || formatHHMM(start, timezone) !== time) return null;
    const end = new Date(start.getTime() + durationMinutes * MINUTE_MS);
    return {
      resourceReservation: {
        bookingUnitId, startsAt: start.toISOString(), endsAt: end.toISOString(),
      },
      blockStart: new Date(start.getTime() - prepMinutes * MINUTE_MS),
      blockEnd: new Date(end.getTime() + cleanupMinutes * MINUTE_MS),
    };
  } catch {
    return null;
  }
}

const DURATION_PRESETS = [15, ...Array.from({ length: 16 }, (_, index) => (index + 1) * 30)];

/** Always offer the configured minimum, even between the usual presets. */
export function manualPlaceDurationChoices(minDurationMinutes: number | null): number[] {
  const minimum = minDurationMinutes ?? 15;
  if (!Number.isInteger(minimum) || minimum < 1 || minimum > 1440) return [];
  return [...new Set([...DURATION_PRESETS, minimum])]
    .filter((minutes) => minutes >= minimum)
    .sort((a, b) => a - b);
}
