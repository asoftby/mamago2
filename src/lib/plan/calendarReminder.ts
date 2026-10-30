/**
 * Calendar-month reminder arithmetic for civil dates.
 * A date that does not exist in the target month is clamped to its final day
 * (March 31 -> February 28/29), rather than subtracting 30 * 24 hours.
 * All calculations operate on UTC calendar fields, independent of server TZ.
 */
export function subtractCalendarMonths(date: Date, months: number): Date {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()) ||
      !Number.isInteger(months) || months < 1 || months > 12) {
    throw new RangeError("invalid_calendar_month_offset");
  }
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetFirst = new Date(Date.UTC(y, m - months, 1));
  const targetYear = targetFirst.getUTCFullYear();
  const targetMonth = targetFirst.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}
