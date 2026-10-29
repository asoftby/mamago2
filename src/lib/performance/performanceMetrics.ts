import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { addDateKeyDays, startOfZonedDay, zonedDateKey } from "@/lib/stories/ranges";

export type PerformancePeriod = "today" | "7d" | "30d";

export type PerformanceWindow = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  dayCount: number;
};

const PERIOD_DAYS: Record<PerformancePeriod, number> = { today: 1, "7d": 7, "30d": 30 };

export function parsePerformancePeriod(value: string | null | undefined): PerformancePeriod {
  return value === "today" || value === "30d" ? value : "7d";
}
export function resolvePerformanceWindow(
  period: PerformancePeriod,
  now = new Date(),
  timeZone = DEFAULT_TZ,
): PerformanceWindow {
  const dayCount = PERIOD_DAYS[period];
  const todayKey = zonedDateKey(now, timeZone);
  const startKey = addDateKeyDays(todayKey, -(dayCount - 1));
  const start = startOfZonedDay(startKey, timeZone);
  const end = now;
  const previousStart = startOfZonedDay(addDateKeyDays(startKey, -dayCount), timeZone);
  return { start, end, previousStart, previousEnd: start, dayCount };
}

/**
 * Window of `dayCount` COMPLETED Minsk days ending at the last midnight, plus
 * the equally-sized window right before it. Unlike `resolvePerformanceWindow`
 * (which ends "now" and therefore holds a partial current day), both windows
 * here are whole days, so a week-over-week / month-over-month comparison does
 * not depend on the weekday/hour the metric is computed (ТЗ «Аналитика
 * админки», C1).
 *
 * `end` / `previousEnd` are exclusive midnight bounds, matching SQL `createdAt < end`.
 * Adjacent windows do not overlap or omit the final millisecond.
 */
export function resolveCompletedWindow(dayCount: number, now = new Date(), timeZone = DEFAULT_TZ): PerformanceWindow {
  const todayKey = zonedDateKey(now, timeZone);
  const todayStart = startOfZonedDay(todayKey, timeZone);
  const start = startOfZonedDay(addDateKeyDays(todayKey, -dayCount), timeZone);
  const previousStart = startOfZonedDay(addDateKeyDays(todayKey, -2 * dayCount), timeZone);
  return {
    start,
    end: todayStart,
    previousStart,
    previousEnd: start,
    dayCount,
  };
}

export function ratioPercent(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

export function comparisonPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
