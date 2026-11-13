import { addDaysLocal } from "@/lib/date/localDateKey";
import { extractScheduleOccurrences } from "./materializeScheduleSessions";

/** Editor-only default for a booking slot derived from the event schedule. */
export type ScheduleTimeSlotSuggestion = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm, or "" when the schedule item has no usable time (all-day). */
  startTime: string;
  /** HH:mm, or "" when unknown / not later than startTime on the same day. */
  endTime: string;
};

type ScheduleItemInput = {
  date?: string | null;
  dateEnd?: string | null;
  allDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  recurringEnabled?: boolean;
  recurrenceInterval?: number;
  recurrenceUnit?: string | null;
  recurrenceUntil?: string | null;
};

export type ScheduleTimeSlotSuggestions = {
  suggestions: ScheduleTimeSlotSuggestion[];
  /** True when the schedule produced more occurrences than `limit`. */
  truncated: boolean;
};

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Upper bound on prefilled slots so a long recurrence cannot flood the form. */
export const MAX_SCHEDULE_TIME_SLOT_SUGGESTIONS = 60;
const SUGGESTION_WINDOW_DAYS = 366;

/**
 * Default "Даты и слоты" rows for the event wizard, derived from the schedule
 * step. Dates/recurrence come from the canonical ActivitySession materializer
 * (`extractScheduleOccurrences`), so a suggested slot's date+startTime is
 * exactly the key the booking layer matches against a session.
 *
 * Pure and client-safe: no I/O. Past dates (before `today`) are skipped.
 */
export function buildTimeSlotSuggestionsFromSchedule(
  scheduleItems: readonly ScheduleItemInput[] | null | undefined,
  options: { today: string; limit?: number },
): ScheduleTimeSlotSuggestions {
  const limit = options.limit ?? MAX_SCHEDULE_TIME_SLOT_SUGGESTIONS;
  const window = {
    from: options.today,
    to: addDaysLocal(options.today, SUGGESTION_WINDOW_DAYS),
  };
  const byKey = new Map<string, ScheduleTimeSlotSuggestion>();

  for (const item of scheduleItems ?? []) {
    const timed =
      item.allDay !== true &&
      typeof item.startTime === "string" &&
      TIME_RE.test(item.startTime);
    const startTime = timed ? (item.startTime as string) : "";
    const endTime =
      timed &&
      typeof item.endTime === "string" &&
      TIME_RE.test(item.endTime) &&
      item.endTime > startTime
        ? item.endTime
        : "";

    for (const occurrence of extractScheduleOccurrences({ scheduleItems: [item] }, window)) {
      const key = `${occurrence.date}|${startTime}`;
      if (!byKey.has(key)) byKey.set(key, { date: occurrence.date, startTime, endTime });
    }
  }

  const sorted = [...byKey.values()].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
  return { suggestions: sorted.slice(0, limit), truncated: sorted.length > limit };
}
