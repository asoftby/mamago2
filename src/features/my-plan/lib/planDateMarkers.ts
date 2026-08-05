import { getLocalDateKey } from "@/lib/date/localDateKey";
import type { PlanItemWithActivity } from "../types/event";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Stable civil date key used by PlanItem.date and the plan calendar. */
export function planDateKey(value: string | Date): string | null {
  if (typeof value === "string" && DATE_KEY_RE.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : getLocalDateKey(date);
}

/**
 * Server summary is the baseline. A loaded day is a newer server/optimistic
 * snapshot and therefore replaces that date's summary count, including zero.
 */
export function reconcilePlanMarkerCounts(
  serverCounts: Record<string, number> | null | undefined,
  loadedItemsByDate: Record<string, PlanItemWithActivity[]>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [rawDate, count] of Object.entries(serverCounts ?? {})) {
    const date = planDateKey(rawDate);
    if (date && Number.isFinite(count) && count > 0) result[date] = count;
  }
  for (const [rawDate, items] of Object.entries(loadedItemsByDate)) {
    const date = planDateKey(rawDate);
    if (!date) continue;
    if (items.length > 0) result[date] = items.length;
    else delete result[date];
  }
  return result;
}

export function planMarkerDates(countsByDate: Record<string, number>): Set<string> {
  return new Set(
    Object.entries(countsByDate)
      .filter(([, count]) => count > 0)
      .map(([date]) => date),
  );
}
