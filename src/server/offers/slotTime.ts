import { formatInTimeZone, getTimezoneOffset } from "date-fns-tz";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export function dateKeyInZone(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

export function localMinuteKey(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd HH:mm");
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function isoWeekday(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Convert a wall-clock minute to UTC. Invalid spring-gap times return null;
 * when the clock repeats in autumn the first (earlier) occurrence wins.
 */
export function localMinuteToUtc(
  dateKey: string,
  minutes: number,
  timezone: string,
): Date | null {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  const wallMs = Date.UTC(year, month - 1, day) + minutes * MINUTE_MS;
  const expected = new Date(wallMs).toISOString().slice(0, 16).replace("T", " ");
  const offsets = new Set<number>();
  for (const delta of [-2 * DAY_MS, -DAY_MS, 0, DAY_MS, 2 * DAY_MS]) {
    const offset = getTimezoneOffset(timezone, new Date(wallMs + delta));
    if (Number.isFinite(offset)) offsets.add(offset);
  }
  const candidates = [...offsets]
    .map((offset) => new Date(wallMs - offset))
    .filter((candidate) => localMinuteKey(candidate, timezone) === expected)
    .sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] ?? null;
}

export function parseClockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) return 1440;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
