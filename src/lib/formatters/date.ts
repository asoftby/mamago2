import { DEFAULT_TZ } from "@/server/geo/geoConstants";

/**
 * Date Formatters
 * Deterministic date formatting for SSR + client hydration.
 *
 * Public calendar/time values are formatted in an explicit product timezone
 * (Europe/Minsk for the Belarus MVP) instead of the ambient OS/browser zone.
 */

const RU_MONTH_SHORT = [
  "янв.", "фев.", "мар.", "апр.", "мая", "июн.",
  "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."
];

export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * Read calendar/time components in an explicit IANA timezone.
 * Never uses Date#getHours()/getDate(), so output is independent of the
 * executing server or browser timezone.
 */
export function getZonedDateTimeParts(
  date: Date | string,
  timeZone: string = DEFAULT_TZ,
): ZonedDateTimeParts | null {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  const result = {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };

  return Object.values(result).every(Number.isFinite) ? result : null;
}

/** Format date as short Russian day + month (e.g. "4 мар."). */
export function formatRuShortDayMonth(date: Date | string): string {
  try {
    const p = getZonedDateTimeParts(date);
    if (!p) return "";
    return `${p.day} ${RU_MONTH_SHORT[p.month - 1]}`;
  } catch (error) {
    console.error("formatRuShortDayMonth error:", error);
    return "";
  }
}

function sameCalendarDay(a: ZonedDateTimeParts, b: ZonedDateTimeParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Одна дата или интервал: «4 апр.», «4–5 апр.», «4 апр.–5 мар.». */
export function formatRuShortDayMonthRange(
  start: Date | string,
  end?: Date | string | null,
): string {
  try {
    const s = getZonedDateTimeParts(start);
    if (!s) return "";
    if (end == null || end === "") return `${s.day} ${RU_MONTH_SHORT[s.month - 1]}`;

    const e = getZonedDateTimeParts(end);
    if (!e) return `${s.day} ${RU_MONTH_SHORT[s.month - 1]}`;
    if (sameCalendarDay(s, e)) return `${s.day} ${RU_MONTH_SHORT[s.month - 1]}`;
    if (s.year === e.year && s.month === e.month) {
      return `${s.day}–${e.day} ${RU_MONTH_SHORT[s.month - 1]}`;
    }
    return `${s.day} ${RU_MONTH_SHORT[s.month - 1]}–${e.day} ${RU_MONTH_SHORT[e.month - 1]}`;
  } catch (error) {
    console.error("formatRuShortDayMonthRange error:", error);
    return formatRuShortDayMonth(start);
  }
}

/** Compact and grammatically correct Russian range for a custom heading.
 * Same month: «с 21 по 25 окт.»; different months: «с 21 окт. по 25 ноя.».
 * For a single date, returns «21 окт.». Do not parse YYYY-MM-DD as a UTC
 * instant: these are civil dates, independent of the user's timezone.
 */
export function formatRuCustomDateRangeTitle(
  dateFrom: string | null,
  dateTo: string | null,
): string {
  const parse = (key: string | null): { day: number; month: number; year: number } | null => {
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const [year, month, day] = key.split("-").map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return { year, month, day };
  };
  const from = parse(dateFrom);
  if (!from) return "";
  const to = parse(dateTo);
  const start = `${from.day} ${RU_MONTH_SHORT[from.month - 1]}`;
  if (!to || (from.year === to.year && from.month === to.month && from.day === to.day)) return start;

  const fromYear = from.year !== to.year ? ` ${from.year}` : "";
  const toYear = from.year !== to.year ? ` ${to.year}` : "";
  if (from.year === to.year && from.month === to.month) {
    return `с ${from.day} по ${to.day} ${RU_MONTH_SHORT[from.month - 1]}`;
  }
  return `с ${start}${fromYear} по ${to.day} ${RU_MONTH_SHORT[to.month - 1]}${toYear}`;
}

/**
 * Format a Date or ISO string as HH:mm in the explicit product timezone.
 * This is intentionally not the viewer/browser timezone: event schedules are
 * venue-local wall-clock values.
 */
export function formatHHMM(
  date: Date | string | null | undefined,
  timeZone: string = DEFAULT_TZ,
): string {
  if (!date) return "";
  const p = getZonedDateTimeParts(date, timeZone);
  if (!p) return "";
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

if (process.env.NODE_ENV === "development") {
  const testDate = new Date("2024-03-04T09:00:00Z");
  const result = formatRuShortDayMonth(testDate);
  if (!result.match(/^\d{1,2}\s[а-я]{3,4}\.?$/)) {
    console.warn(
      `[formatRuShortDayMonth] Unexpected format: "${result}". Expected pattern: "4 мар."`,
    );
  }
}
