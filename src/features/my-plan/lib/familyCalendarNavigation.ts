import { addDaysIso, getWeekStart } from "./weekCalendar";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toISOString().slice(0, 10) === value;
}

export function resolveCalendarDateParam(value: unknown, today: string): string {
  return isValidCalendarDate(value) ? value : today;
}

export function calendarWeekRange(date: string): { from: string; to: string } {
  const from = getWeekStart(date);
  return { from, to: addDaysIso(from, 6) };
}

export function shouldFetchCalendarWeek<T>(cache: Readonly<Record<string, readonly T[]>>, date: string): boolean {
  return cache[getWeekStart(date)] === undefined;
}

export function upsertCalendarWeekItem<T extends { id: string; date: string }>(
  cache: Readonly<Record<string, readonly T[]>>,
  item: T,
): Record<string, T[]> {
  const next: Record<string, T[]> = {};
  for (const [week, items] of Object.entries(cache)) {
    next[week] = items.filter((current) => current.id !== item.id);
  }
  const targetWeek = getWeekStart(item.date);
  next[targetWeek] = [...(next[targetWeek] ?? []), item];
  return next;
}
