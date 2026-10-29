/**
 * ISO-week helpers over Minsk civil date keys ("YYYY-MM-DD"). Weeks start on
 * Monday 00:00 in the analytics time zone (ТЗ «Аналитика админки», C4).
 */
import { addDateKeyDays, startOfZonedDay, weekdayFromDateKey } from "@/lib/stories/ranges";
import { ANALYTICS_TIME_ZONE } from "./metricDefinitions";

/** Date key of the Monday of the ISO week containing `dateKey`. */
export function isoWeekMondayKey(dateKey: string): string {
  const weekday = weekdayFromDateKey(dateKey); // 0 = Sunday
  const sinceMonday = (weekday + 6) % 7;
  return addDateKeyDays(dateKey, -sinceMonday);
}

export interface IsoWeekRange {
  /** Monday key of the week. */
  mondayKey: string;
  /** Monday 00:00 (Minsk) — inclusive. */
  start: Date;
  /** Next Monday 00:00 (Minsk) — exclusive. */
  end: Date;
}

/** The ISO week starting on `mondayKey`, as an [start, end) instant range. */
export function isoWeekRange(mondayKey: string, timeZone = ANALYTICS_TIME_ZONE): IsoWeekRange {
  return {
    mondayKey,
    start: startOfZonedDay(mondayKey, timeZone),
    end: startOfZonedDay(addDateKeyDays(mondayKey, 7), timeZone),
  };
}
