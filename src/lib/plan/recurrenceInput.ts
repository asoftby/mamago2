import { expandRecurrence, type RecurrenceRule } from "./recurrence";

/** Strict boundary for creating a manual-task recurrence series. No DB writes. */
export function validateRecurrenceInput(value: unknown): RecurrenceRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_recurrence");
  const v = value as Record<string, unknown>;
  if (v.frequency !== "DAILY" && v.frequency !== "WEEKLY" && v.frequency !== "MONTHLY") throw new Error("invalid_frequency");
  if (typeof v.startDate !== "string") throw new Error("invalid_start_date");
  if (typeof v.interval !== "number" || !Number.isInteger(v.interval) || v.interval < 1 || v.interval > 365) throw new Error("invalid_interval");
  if (v.untilDate !== undefined && v.untilDate !== null && typeof v.untilDate !== "string") throw new Error("invalid_until_date");
  if (v.maxOccurrences !== undefined && v.maxOccurrences !== null && (typeof v.maxOccurrences !== "number" || !Number.isInteger(v.maxOccurrences) || v.maxOccurrences < 1 || v.maxOccurrences > 10000)) throw new Error("invalid_count");
  const weekdays = v.weekdays === undefined ? [] : v.weekdays;
  if (!Array.isArray(weekdays) || weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7)) throw new Error("invalid_weekdays");
  if (v.frequency === "WEEKLY" && (weekdays.length === 0 || new Set(weekdays).size !== weekdays.length)) throw new Error("invalid_weekdays");
  if (v.frequency !== "WEEKLY" && weekdays.length) throw new Error("unexpected_weekdays");
  const rule: RecurrenceRule = {
    frequency: v.frequency,
    interval: v.interval,
    startDate: v.startDate,
    weekdays,
    untilDate: v.untilDate as string | null | undefined,
    maxOccurrences: v.maxOccurrences as number | null | undefined,
  };
  // Validate both civil dates and that the first day belongs to the series.
  const first = expandRecurrence(rule, rule.startDate, rule.startDate);
  if (first.length !== 1) throw new Error("recurrence_start_not_in_series");
  return rule;
}
