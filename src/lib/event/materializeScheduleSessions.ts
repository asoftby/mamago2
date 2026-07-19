import { expandScheduleItemDates } from "./expandScheduleItemDates";

export type ScheduleJsonLike = {
  dates?: unknown;
  startTime?: unknown;
  scheduleItems?: unknown;
};

/**
 * The one canonical rule for turning a schedule (single dates and/or
 * `{date, dateEnd}` ranges) into the exact list of calendar-day date keys
 * that become `ActivitySession` rows: `scheduleItems` wins when present
 * (expanded via `expandScheduleItemDates`, which already dedupes/sorts —
 * overlapping or adjacent ranges never produce duplicate sessions), falling
 * back to the raw `dates` array only when there are no `scheduleItems` at
 * all. Shared by the real write path (`replaceActivitySessionsFromScheduleJson`
 * in `syncEventActivitySessions.ts`, which re-exports this) and migration
 * preview/reporting — moved here specifically so neither one can drift from
 * the other into a second, independent range-expansion implementation.
 */
export function extractScheduleDatesAndStartTime(scheduleJson: unknown): {
  dates: string[];
  startTime: string;
} {
  const j = scheduleJson as ScheduleJsonLike | null | undefined;

  let dates: string[] = [];

  let startTime =
    typeof j?.startTime === "string" && /^\d{2}:\d{2}$/.test(j.startTime)
      ? j.startTime
      : "10:00";

  if (j && Array.isArray(j.scheduleItems) && j.scheduleItems.length > 0) {
    const items = j.scheduleItems as Array<{ date?: unknown; dateEnd?: unknown; startTime?: unknown }>;
    dates = expandScheduleItemDates(items);
    const firstSt = items[0]?.startTime;
    if (typeof firstSt === "string" && /^\d{2}:\d{2}$/.test(firstSt)) {
      startTime = firstSt;
    }
  }

  if (dates.length === 0 && j && Array.isArray(j.dates)) {
    dates = (j.dates as unknown[]).filter(
      (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
    );
  }

  return { dates, startTime };
}

export interface MaterializedEventSchedule {
  /** Raw `scheduleItems.length` — 0 when the schedule has no ranges at all (plain `dates`). Diagnostic only. */
  rawRangeCount: number;
  /** Raw `dates.length` on the schedule as received — the boundary-marker count for range schedules, or the true session count for non-range ones. Diagnostic only, never the reported session count. */
  boundaryDateCount: number;
  /** The exact date keys `replaceActivitySessionsFromScheduleJson` would create one `ActivitySession` per — same order/dedup as the real write. */
  materializedDates: readonly string[];
  /** `materializedDates.length` — the number to report as "sessions," not `boundaryDateCount`. */
  materializedSessionCount: number;
  firstSessionDate: string | null;
  lastSessionDate: string | null;
}

const EMPTY_MATERIALIZED_SCHEDULE: MaterializedEventSchedule = {
  rawRangeCount: 0,
  boundaryDateCount: 0,
  materializedDates: [],
  materializedSessionCount: 0,
  firstSessionDate: null,
  lastSessionDate: null,
};

/**
 * Reporting-facing wrapper around {@link extractScheduleDatesAndStartTime}:
 * same materialized dates the real commit would create, plus the raw
 * range/boundary-date counts so a preview can show *why* the materialized
 * count differs from a naive `dates.length` read for range-based schedules
 * (see `wordpress-db:events:60404`: 6 boundary dates across 3 ranges
 * materialize to 36 daily sessions).
 */
export function materializeEventScheduleSessions(scheduleJson: unknown): MaterializedEventSchedule {
  if (scheduleJson === null || scheduleJson === undefined) {
    return EMPTY_MATERIALIZED_SCHEDULE;
  }

  const j = scheduleJson as ScheduleJsonLike;
  const { dates } = extractScheduleDatesAndStartTime(scheduleJson);
  const sortedForDisplay = [...dates].sort();

  return {
    rawRangeCount: Array.isArray(j.scheduleItems) ? j.scheduleItems.length : 0,
    boundaryDateCount: Array.isArray(j.dates) ? j.dates.length : 0,
    materializedDates: dates,
    materializedSessionCount: dates.length,
    firstSessionDate: sortedForDisplay[0] ?? null,
    lastSessionDate: sortedForDisplay[sortedForDisplay.length - 1] ?? null,
  };
}
