/**
 * Calendar-date helpers for booking-slot dates stored as "YYYY-MM-DD".
 *
 * A slot date is a calendar day without a time or zone. Never convert it through
 * `toISOString()` / UTC: local midnight east of Greenwich is the previous UTC day
 * (Europe/Minsk, Pacific/Kiritimati), so `new Date(y, m, d).toISOString()` shifts the date.
 * Everything here uses local date parts (or a fixed UTC noon for formatting only).
 */

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type YmdParts = { year: number; month: number; day: number };

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Parses a strict "YYYY-MM-DD" value; rejects impossible dates such as 2026-02-30. */
export function parseSlotDate(value: string): YmdParts | null {
  const match = YMD_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return null;
  if (day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * Local `Date` for the calendar widget. Noon (not midnight) keeps the same calendar
 * day in zones where a DST jump skips local midnight.
 */
export function slotDateToLocalDate(value: string): Date | null {
  const parts = parseSlotDate(value);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day, 12);
}

/** "YYYY-MM-DD" from the local calendar day of a `Date` returned by the calendar widget. */
export function localDateToSlotDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const LABEL_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Human label for a slot date (for example "16 ноября 2026 г."). Formatted from a
 * fixed UTC noon, so the shown day never depends on the browser time zone.
 */
export function formatSlotDateLabel(value: string): string | null {
  const parts = parseSlotDate(value);
  if (!parts) return null;
  return LABEL_FORMATTER.format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)));
}
