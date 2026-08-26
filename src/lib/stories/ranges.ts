import { fromZonedTime } from "date-fns-tz";
import type { DateRange, ResolveContext } from "./types";

/** Civil YYYY-MM-DD for `instant` in `timeZone`. */
export function zonedDateKey(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Weekday of a civil date key (0 = Sunday … 6 = Saturday).
 * A YYYY-MM-DD civil date has a unique weekday worldwide.
 */
export function weekdayFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12)).getUTCDay();
}

export function addDateKeyDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** Instant of local midnight for `dateKey` in `timeZone`. */
export function startOfZonedDay(dateKey: string, timeZone: string): Date {
  return fromZonedTime(`${dateKey}T00:00:00`, timeZone);
}

/** Half-open [dateKey 00:00, dateKey+dayCount 00:00) in `timeZone`. */
export function zonedDayRange(
  dateKey: string,
  dayCount: number,
  timeZone: string,
): DateRange {
  return {
    start: startOfZonedDay(dateKey, timeZone),
    end: startOfZonedDay(addDateKeyDays(dateKey, dayCount), timeZone),
  };
}

export function todayRange(ctx: ResolveContext): DateRange {
  const key = zonedDateKey(ctx.now, ctx.timeZone);
  return zonedDayRange(key, 1, ctx.timeZone);
}

/**
 * Generic contextual horizon [today 00:00, today+N 00:00) in city TZ.
 * The historical function name is retained for compatibility; the public
 * `running` source itself now uses {@link todayRange}.
 */
export function runningHorizonRange(
  ctx: ResolveContext,
  horizonDays: number,
): DateRange {
  const key = zonedDateKey(ctx.now, ctx.timeZone);
  return zonedDayRange(key, horizonDays, ctx.timeZone);
}

export function tomorrowRange(ctx: ResolveContext): DateRange {
  const key = addDateKeyDays(zonedDateKey(ctx.now, ctx.timeZone), 1);
  return zonedDayRange(key, 1, ctx.timeZone);
}

/**
 * Upcoming Sat–Sun window in city TZ.
 * - Sat: null (today already covers «сегодня», weekend bubble is redundant)
 * - Sun: next weekend (following Sat–Sun)
 * - Mon–Fri: this week's Sat–Sun
 */
export function weekendRange(ctx: ResolveContext): DateRange | null {
  const todayKey = zonedDateKey(ctx.now, ctx.timeZone);
  const weekday = weekdayFromDateKey(todayKey);

  if (weekday === 6) return null;

  if (weekday === 0) {
    const nextSat = addDateKeyDays(todayKey, 6);
    return zonedDayRange(nextSat, 2, ctx.timeZone);
  }

  const daysToSat = 6 - weekday;
  const sat = addDateKeyDays(todayKey, daysToSat);
  return zonedDayRange(sat, 2, ctx.timeZone);
}

/**
 * Upcoming Mon–Fri work week.
 * - Mon–Fri: null (overlaps today/tomorrow; would survive absorption incorrectly)
 * - Sat: next Mon–Fri («на следующей неделе»)
 * - Sun: coming Mon–Fri («на неделе»)
 */
export function nextWeekRange(ctx: ResolveContext): DateRange | null {
  const todayKey = zonedDateKey(ctx.now, ctx.timeZone);
  const weekday = weekdayFromDateKey(todayKey);

  if (weekday >= 1 && weekday <= 5) return null;

  if (weekday === 6) {
    const mon = addDateKeyDays(todayKey, 2);
    return zonedDayRange(mon, 5, ctx.timeZone);
  }

  // Sunday
  const mon = addDateKeyDays(todayKey, 1);
  return zonedDayRange(mon, 5, ctx.timeZone);
}

export function weekendLabel(ctx: ResolveContext): string {
  const todayKey = zonedDateKey(ctx.now, ctx.timeZone);
  return weekdayFromDateKey(todayKey) === 0 ? "Следующие выходные" : "Выходные";
}

export function nextWeekLabel(ctx: ResolveContext): string {
  const todayKey = zonedDateKey(ctx.now, ctx.timeZone);
  return weekdayFromDateKey(todayKey) === 6 ? "На следующей неделе" : "На неделе";
}

/** True when `inner` is fully inside `outer` (half-open ranges). */
export function rangeFullyCoveredBy(inner: DateRange, outer: DateRange): boolean {
  return (
    inner.start.getTime() >= outer.start.getTime() &&
    inner.end.getTime() <= outer.end.getTime()
  );
}
