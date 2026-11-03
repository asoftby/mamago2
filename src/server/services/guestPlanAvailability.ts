import { fromZonedTime } from "date-fns-tz";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { collectConfirmedOccurrences } from "@/server/services/recommendations/familyPicks/window";

/**
 * A guest day plan has a strict Minsk-local calendar window. The weekend picker
 * explicitly passes Saturday–Sunday, rather than treating Saturday as the only day.
 */
export function guestPlanDateWindow(date: string, dateTo = date) {
  const endDay = new Date(`${dateTo}T12:00:00Z`);
  endDay.setUTCDate(endDay.getUTCDate() + 1);
  const nextDay = endDay.toISOString().slice(0, 10);
  return {
    start: fromZonedTime(`${date}T00:00:00`, DEFAULT_TZ),
    end: fromZonedTime(`${nextDay}T00:00:00`, DEFAULT_TZ),
  };
}

/** Confirmed timestamp, not an invented morning/afternoon/evening slot. */
export function firstGuestPlanOccurrence(input: {
  sessions: readonly { startsAt: Date; withdrawnAt: Date | null }[];
  hasStoredSessions: boolean;
  nextOccurrenceAt: Date | null;
  rangeStart: Date;
  rangeEnd: Date;
  now: Date;
}): Date | null {
  return collectConfirmedOccurrences(input)[0] ?? null;
}
