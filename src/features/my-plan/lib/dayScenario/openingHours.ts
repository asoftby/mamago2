/**
 * Pure evaluation of a Place's opening hours for one calendar day, for the
 * day-scenario filler places. No database, no clock.
 *
 * - WEEKLY: the day's rule decides (exceptions for the exact date override it).
 * - ALWAYS_OPEN: open all day.
 * - BY_APPOINTMENT / TEMPORARILY_CLOSED: never offered as a filler.
 * - No hours record at all: availability is unknown (offered with a note).
 */

export type HoursDay = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export type HoursMode = "WEEKLY" | "ALWAYS_OPEN" | "BY_APPOINTMENT" | "TEMPORARILY_CLOSED";

export type HoursInterval = { startTime: string; endTime: string };
export type HoursRule = { dayOfWeek: HoursDay; isOpen: boolean; allDay: boolean; intervals: HoursInterval[] };
export type HoursException = { date: string; isClosed: boolean; allDay: boolean; intervals: HoursInterval[] };
export type PlaceHours = {
  mode: HoursMode;
  timezone: string;
  rules: HoursRule[];
  exceptions: HoursException[];
};

/** Open ranges as minutes since local midnight, end exclusive (0..1440). */
export type DayAvailability =
  | { kind: "unknown" }
  | { kind: "always" }
  | { kind: "closed" }
  | { kind: "windows"; windows: { startMin: number; endMin: number }[] };

const DAYS: HoursDay[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function weekdayOf(dateIso: string): HoursDay {
  const [y, m, d] = dateIso.split("-").map(Number);
  return DAYS[new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay()]!;
}

function parseMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes <= 1440 ? minutes : null;
}

function windowsFrom(intervals: HoursInterval[]): { startMin: number; endMin: number }[] {
  const out: { startMin: number; endMin: number }[] = [];
  for (const interval of intervals) {
    const startMin = parseMinutes(interval.startTime);
    let endMin = parseMinutes(interval.endTime);
    if (startMin == null || endMin == null) continue;
    // "until 00:00" or an overnight interval: only the part up to midnight belongs to this day.
    if (endMin <= startMin) endMin = 1440;
    if (endMin > startMin) out.push({ startMin, endMin });
  }
  return out.sort((a, b) => a.startMin - b.startMin);
}

/** `hours` null = the place has no hours record. */
export function resolveDayAvailability(hours: PlaceHours | null, dateIso: string): DayAvailability {
  if (!hours) return { kind: "unknown" };
  if (hours.mode === "BY_APPOINTMENT" || hours.mode === "TEMPORARILY_CLOSED") return { kind: "closed" };
  if (hours.mode === "ALWAYS_OPEN") return { kind: "always" };

  const exception = hours.exceptions.find((e) => e.date === dateIso);
  if (exception) {
    if (exception.isClosed) return { kind: "closed" };
    if (exception.allDay) return { kind: "always" };
    const windows = windowsFrom(exception.intervals);
    return windows.length > 0 ? { kind: "windows", windows } : { kind: "closed" };
  }

  const rule = hours.rules.find((r) => r.dayOfWeek === weekdayOf(dateIso));
  if (!rule || !rule.isOpen) return { kind: "closed" };
  if (rule.allDay) return { kind: "always" };
  const windows = windowsFrom(rule.intervals);
  return windows.length > 0 ? { kind: "windows", windows } : { kind: "closed" };
}
