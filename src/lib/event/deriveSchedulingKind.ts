export type DerivedSchedulingKind = "SLOT" | "WINDOW";

type SchedulingKindScheduleItem = {
  isMultiDay?: boolean;
  date?: string | null;
  dateEnd?: string | null;
  allDay?: boolean;
  startTime?: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validStartTime(value: unknown): boolean {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

function hasCompletedDateRange(item: SchedulingKindScheduleItem): boolean {
  return Boolean(
    typeof item.date === "string" &&
      typeof item.dateEnd === "string" &&
      DATE_PATTERN.test(item.date) &&
      DATE_PATTERN.test(item.dateEnd) &&
      item.dateEnd > item.date,
  );
}

/**
 * Scheduling kind is an internal projection of the schedule, not an editor choice.
 * Only a completed multi-day/date-range or all-day schedule is a visit window.
 * Toggling multi-day without selecting an end date must not reclassify a timed
 * single-day occurrence as WINDOW.
 */
export function deriveSchedulingKindFromScheduleItems(
  items: readonly SchedulingKindScheduleItem[],
): DerivedSchedulingKind {
  const hasWindowItem = items.some(
    (item) => item.allDay === true || hasCompletedDateRange(item),
  );

  return hasWindowItem ? "WINDOW" : "SLOT";
}

/**
 * Conservative read-side fallback for legacy/imported activities whose
 * persisted schedulingKind is null. Returns null only when scheduleJson does
 * not contain enough schedule evidence to classify without guessing.
 */
export function deriveSchedulingKindFromScheduleJson(
  value: unknown,
): DerivedSchedulingKind | null {
  const schedule = record(value);
  if (!schedule) return null;

  const rawItems = Array.isArray(schedule.scheduleItems)
    ? schedule.scheduleItems.map(record).filter((item): item is Record<string, unknown> => item != null)
    : [];
  const fallbackStartTime = validStartTime(schedule.startTime) ? schedule.startTime : null;

  if (rawItems.length > 0) {
    const items: SchedulingKindScheduleItem[] = rawItems.map((item) => ({
      isMultiDay: item.isMultiDay === true,
      date: typeof item.date === "string" ? item.date : null,
      dateEnd: typeof item.dateEnd === "string" ? item.dateEnd : null,
      allDay: item.allDay === true,
      startTime: typeof item.startTime === "string" ? item.startTime : null,
    }));

    if (deriveSchedulingKindFromScheduleItems(items) === "WINDOW") return "WINDOW";

    const everyOccurrenceHasTime = items.every(
      (item) => validStartTime(item.startTime) || fallbackStartTime != null,
    );
    return everyOccurrenceHasTime ? "SLOT" : "WINDOW";
  }

  if (schedule.allDay === true) return "WINDOW";

  const dates = Array.isArray(schedule.dates)
    ? schedule.dates.filter((date): date is string => typeof date === "string" && DATE_PATTERN.test(date))
    : [];
  if (dates.length > 0) {
    return fallbackStartTime != null ? "SLOT" : "WINDOW";
  }

  if (typeof schedule.startAt === "string") {
    const start = new Date(schedule.startAt);
    if (!Number.isNaN(start.getTime())) return "SLOT";
  }

  return null;
}
