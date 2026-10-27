import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

export type ShowWindowMode = "WEEKEND" | "WEEK";

export type ShowWindow = {
  mode: ShowWindowMode;
  /** "YYYY-MM-DD" в Europe/Minsk, включительно. */
  dateFrom: string;
  dateTo: string;
};

function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const next = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  return next.toISOString().slice(0, 10);
}

/** ISO-день недели в Минске: 1 = пн … 7 = вс. */
export function minskIsoWeekday(date: Date): number {
  return Number(formatInTimeZone(date, DEFAULT_TZ, "i"));
}

export function minskDateKey(date: Date): string {
  return formatInTimeZone(date, DEFAULT_TZ, "yyyy-MM-dd");
}

/**
 * Окно показа: чт–вс → ближайшие сб–вс (в сб — сегодня и завтра, в вс — только сегодня),
 * пн–ср → ближайшие `weekHorizonDays` дней начиная с сегодня.
 */
export function resolveShowWindow(now: Date, weekHorizonDays = 7): ShowWindow {
  const today = minskDateKey(now);
  const dow = minskIsoWeekday(now);
  if (dow >= 4) {
    const dateFrom = dow === 6 || dow === 7 ? today : addDaysToKey(today, 6 - dow);
    const dateTo = dow === 7 ? today : addDaysToKey(dateFrom, 1);
    return { mode: "WEEKEND", dateFrom, dateTo };
  }
  return { mode: "WEEK", dateFrom: today, dateTo: addDaysToKey(today, Math.max(1, weekHorizonDays) - 1) };
}

/**
 * Сеансы, которые ещё можно посетить: внутри окна и не раньше `now` (окно начинается в 00:00,
 * поэтому уже закончившиеся сегодня сеансы отсекаются). Фолбэк `nextOccurrenceAt` — только если
 * сеансов нет и значение тоже в [max(start, now), end).
 */
export function collectUpcomingOccurrences(input: {
  sessionStarts: readonly Date[];
  nextOccurrenceAt: Date | null;
  rangeStart: Date;
  rangeEnd: Date;
  now: Date;
}): Date[] {
  const lower = Math.max(input.rangeStart.getTime(), input.now.getTime());
  const upper = input.rangeEnd.getTime();
  const inRange = (d: Date) => d.getTime() >= lower && d.getTime() < upper;
  const fromSessions = input.sessionStarts.filter(inRange);
  if (fromSessions.length > 0) return fromSessions;
  return input.nextOccurrenceAt && inRange(input.nextOccurrenceAt) ? [input.nextOccurrenceAt] : [];
}
