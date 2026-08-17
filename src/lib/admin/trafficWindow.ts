/**
 * Elapsed-today-vs-elapsed-yesterday window for the /admin Traffic block.
 *
 * `resolvePerformanceWindow()`'s built-in comparison window is full
 * previous calendar day (00:00 -> next 00:00), not elapsed-matched — a
 * partial "today so far" would be compared against a full "yesterday",
 * which the frozen Traffic spec explicitly forbids. This computes: today
 * 00:00 (Europe/Minsk) -> now, and yesterday 00:00 -> yesterday at the
 * SAME elapsed duration, reusing the same zoned-date helpers
 * `resolvePerformanceWindow` itself is built on.
 */
import { addDateKeyDays, startOfZonedDay, zonedDateKey } from "@/lib/stories/ranges";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

export interface ElapsedComparisonWindow {
  todayStart: Date;
  todayEnd: Date;
  yesterdayStart: Date;
  yesterdayEnd: Date;
}

export function resolveElapsedTodayVsYesterday(now: Date, timeZone: string = DEFAULT_TZ): ElapsedComparisonWindow {
  const todayKey = zonedDateKey(now, timeZone);
  const todayStart = startOfZonedDay(todayKey, timeZone);
  const elapsedMs = now.getTime() - todayStart.getTime();

  const yesterdayKey = addDateKeyDays(todayKey, -1);
  const yesterdayStart = startOfZonedDay(yesterdayKey, timeZone);
  const yesterdayEnd = new Date(yesterdayStart.getTime() + elapsedMs);

  return { todayStart, todayEnd: now, yesterdayStart, yesterdayEnd };
}
