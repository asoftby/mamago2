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

export type CalendarScenarioStatus = "ready" | "changed";
export type CalendarScheduleSnapshot = {
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  childId: string | null;
};

function markExistingScenarioChanged(
  statuses: Record<string, CalendarScenarioStatus>,
  date: string,
): void {
  if (date in statuses) statuses[date] = "changed";
}

/** Mirrors the fields in computePlanFingerprint that manual edits can change. */
export function scenarioStatusesAfterManualSave(
  current: Readonly<Record<string, CalendarScenarioStatus>>,
  previous: CalendarScheduleSnapshot | null,
  saved: CalendarScheduleSnapshot,
): Record<string, CalendarScenarioStatus> {
  const next = { ...current };
  if (!previous || previous.date !== saved.date) {
    if (previous) markExistingScenarioChanged(next, previous.date);
    markExistingScenarioChanged(next, saved.date);
  } else if (
    previous.startsAt !== saved.startsAt ||
    previous.endsAt !== saved.endsAt ||
    previous.childId !== saved.childId
  ) {
    markExistingScenarioChanged(next, saved.date);
  }
  return next;
}

export function scenarioStatusesAfterManualCancel(
  current: Readonly<Record<string, CalendarScenarioStatus>>,
  removed: Pick<CalendarScheduleSnapshot, "date">,
): Record<string, CalendarScenarioStatus> {
  const next = { ...current };
  markExistingScenarioChanged(next, removed.date);
  return next;
}
