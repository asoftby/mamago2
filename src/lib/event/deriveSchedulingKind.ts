export type DerivedSchedulingKind = "SLOT" | "WINDOW";

type SchedulingKindScheduleItem = {
  isMultiDay?: boolean;
  date?: string | null;
  dateEnd?: string | null;
  allDay?: boolean;
};

/**
 * Scheduling kind is an internal projection of the schedule, not an editor choice.
 * A multi-day/date-range or all-day schedule is a flexible visit window; a
 * single-day schedule with explicit hours is a concrete slot.
 */
export function deriveSchedulingKindFromScheduleItems(
  items: readonly SchedulingKindScheduleItem[],
): DerivedSchedulingKind {
  const hasWindowItem = items.some((item) => {
    if (item.allDay === true || item.isMultiDay === true) return true;

    return Boolean(
      typeof item.date === "string" &&
        typeof item.dateEnd === "string" &&
        item.date.length > 0 &&
        item.dateEnd.length > 0 &&
        item.date !== item.dateEnd,
    );
  });

  return hasWindowItem ? "WINDOW" : "SLOT";
}
