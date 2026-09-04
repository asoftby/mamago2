import { addDaysLocal } from "@/lib/date/localDateKey";
import { expandScheduleItemDates, isLocalDateString } from "./expandScheduleItemDates";

export type ScheduleJsonLike = {
  dates?: unknown;
  startTime?: unknown;
  scheduleItems?: unknown;
};

export type ScheduleOccurrence = {
  date: string;
  startTime: string;
};

type RecurrenceUnit = "day" | "week" | "month" | "year";

type ScheduleItemLike = {
  date?: unknown;
  dateEnd?: unknown;
  startTime?: unknown;
  recurringEnabled?: unknown;
  recurrenceInterval?: unknown;
  recurrenceUnit?: unknown;
  recurrenceUntil?: unknown;
};

const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_RECURRENCE_PERIODS = 10_000;

function normalizeStartTime(value: unknown, fallback = "10:00"): string {
  return typeof value === "string" && TIME_RE.test(value) ? value : fallback;
}

function normalizeRecurrenceUnit(value: unknown): RecurrenceUnit | null {
  return value === "day" || value === "week" || value === "month" || value === "year"
    ? value
    : null;
}

function normalizeRecurrenceInterval(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}

function parseLocalDateParts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function formatLocalDateParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Calendar-only recurrence shift. UTC is used only as a neutral calendar
 * arithmetic container; no venue/local timezone conversion happens here.
 */
function shiftLocalDate(value: string, amount: number, unit: RecurrenceUnit): string {
  if (unit === "day") return addDaysLocal(value, amount);
  if (unit === "week") return addDaysLocal(value, amount * 7);

  const { year, month, day } = parseLocalDateParts(value);

  if (unit === "year") {
    const nextYear = year + amount;
    const nextDay = Math.min(day, daysInMonth(nextYear, month));
    return formatLocalDateParts(nextYear, month, nextDay);
  }

  const absoluteMonth = year * 12 + (month - 1) + amount;
  const nextYear = Math.floor(absoluteMonth / 12);
  const nextMonthIndex = absoluteMonth - nextYear * 12;
  const nextMonth = nextMonthIndex + 1;
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return formatLocalDateParts(nextYear, nextMonth, nextDay);
}

function dayDistance(start: string, end: string): number {
  const s = parseLocalDateParts(start);
  const e = parseLocalDateParts(end);
  const startMs = Date.UTC(s.year, s.month - 1, s.day);
  const endMs = Date.UTC(e.year, e.month - 1, e.day);
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

function expandScheduleItemOccurrences(
  item: ScheduleItemLike,
  fallbackStartTime: string,
): ScheduleOccurrence[] {
  const baseDates = expandScheduleItemDates([item]);
  if (baseDates.length === 0) return [];

  const startTime = normalizeStartTime(item.startTime, fallbackStartTime);
  const baseStart = baseDates[0]!;
  const baseEnd = baseDates[baseDates.length - 1]!;

  const recurrenceUnit = normalizeRecurrenceUnit(item.recurrenceUnit);
  const recurrenceUntil = isLocalDateString(item.recurrenceUntil)
    ? item.recurrenceUntil
    : null;
  const recurring = item.recurringEnabled === true && recurrenceUnit !== null && recurrenceUntil !== null;

  if (!recurring) {
    return baseDates.map((date) => ({ date, startTime }));
  }

  const interval = normalizeRecurrenceInterval(item.recurrenceInterval);
  const spanDays = dayDistance(baseStart, baseEnd);
  const occurrences: ScheduleOccurrence[] = [];

  for (let periodIndex = 0; periodIndex < MAX_RECURRENCE_PERIODS; periodIndex += 1) {
    const periodStart = shiftLocalDate(baseStart, periodIndex * interval, recurrenceUnit);
    if (periodStart > recurrenceUntil) break;

    const periodEnd = addDaysLocal(periodStart, spanDays);
    const effectiveEnd = periodEnd <= recurrenceUntil ? periodEnd : recurrenceUntil;
    const periodDates = expandScheduleItemDates([{ date: periodStart, dateEnd: effectiveEnd }]);
    occurrences.push(...periodDates.map((date) => ({ date, startTime })));
  }

  return occurrences;
}

/**
 * Canonical schedule materialization for ActivitySession rows.
 *
 * Each schedule item keeps its own start time. Date ranges are expanded
 * inclusively. Recurrence repeats the entire range by its configured
 * interval/unit up to recurrenceUntil (inclusive). Duplicate date+time
 * occurrences are collapsed, while two different times on the same date are
 * preserved as two distinct sessions.
 */
export function extractScheduleOccurrences(scheduleJson: unknown): ScheduleOccurrence[] {
  const j = scheduleJson as ScheduleJsonLike | null | undefined;
  const fallbackStartTime = normalizeStartTime(j?.startTime);

  let occurrences: ScheduleOccurrence[] = [];

  if (j && Array.isArray(j.scheduleItems) && j.scheduleItems.length > 0) {
    occurrences = (j.scheduleItems as ScheduleItemLike[]).flatMap((item) =>
      expandScheduleItemOccurrences(item, fallbackStartTime),
    );
  }

  if (occurrences.length === 0 && j && Array.isArray(j.dates)) {
    const dates = (j.dates as unknown[]).filter(isLocalDateString);
    occurrences = dates.map((date) => ({ date, startTime: fallbackStartTime }));
  }

  const unique = new Map<string, ScheduleOccurrence>();
  for (const occurrence of occurrences) {
    unique.set(`${occurrence.date}|${occurrence.startTime}`, occurrence);
  }

  return [...unique.values()].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}

/**
 * Backward-compatible date/start-time projection for legacy callers.
 * New write/fingerprint paths must use extractScheduleOccurrences so
 * per-item times and recurrence are not lost.
 */
export function extractScheduleDatesAndStartTime(scheduleJson: unknown): {
  dates: string[];
  startTime: string;
} {
  const j = scheduleJson as ScheduleJsonLike | null | undefined;
  const occurrences = extractScheduleOccurrences(scheduleJson);
  const dates = [...new Set(occurrences.map((occurrence) => occurrence.date))].sort();
  const startTime = occurrences[0]?.startTime ?? normalizeStartTime(j?.startTime);
  return { dates, startTime };
}

export interface MaterializedEventSchedule {
  /** Number of scheduleItems entries carrying a valid dateEnd. Diagnostic only. */
  rawRangeCount: number;
  /** Raw dates.length on the schedule as received. Diagnostic only. */
  boundaryDateCount: number;
  /** Exact occurrence list the ActivitySession writer would create. */
  materializedOccurrences: readonly ScheduleOccurrence[];
  /** One date entry per materialized session; duplicate dates are valid when times differ. */
  materializedDates: readonly string[];
  /** Exact ActivitySession count after date+time deduplication. */
  materializedSessionCount: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
}

const EMPTY_MATERIALIZED_SCHEDULE: MaterializedEventSchedule = {
  rawRangeCount: 0,
  boundaryDateCount: 0,
  materializedOccurrences: [],
  materializedDates: [],
  materializedSessionCount: 0,
  firstSessionDate: null,
  lastSessionDate: null,
};

/** Reporting-facing wrapper around the exact occurrence materializer. */
export function materializeEventScheduleSessions(scheduleJson: unknown): MaterializedEventSchedule {
  if (scheduleJson === null || scheduleJson === undefined) {
    return EMPTY_MATERIALIZED_SCHEDULE;
  }

  const j = scheduleJson as ScheduleJsonLike;
  const occurrences = extractScheduleOccurrences(scheduleJson);
  const dates = occurrences.map((occurrence) => occurrence.date);
  const scheduleItems = Array.isArray(j.scheduleItems)
    ? (j.scheduleItems as Array<{ dateEnd?: unknown }>)
    : [];

  return {
    rawRangeCount: scheduleItems.filter((item) => isLocalDateString(item.dateEnd)).length,
    boundaryDateCount: Array.isArray(j.dates) ? j.dates.length : 0,
    materializedOccurrences: occurrences,
    materializedDates: dates,
    materializedSessionCount: occurrences.length,
    firstSessionDate: dates[0] ?? null,
    lastSessionDate: dates[dates.length - 1] ?? null,
  };
}
