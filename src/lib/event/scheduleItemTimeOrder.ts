import { addDaysLocal } from "@/lib/date/localDateKey";
import { isLocalDateString } from "./expandScheduleItemDates";

export interface ScheduleItemTimeOrderInput {
  date?: string | null;
  dateEnd?: string | null;
  isMultiDay?: boolean;
  allDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

export interface ScheduleItemTimeOrderResult {
  /** false only when endTime <= startTime on what resolves to the same calendar day. */
  isValid: boolean;
  /** True when a single-day item's end time was auto-interpreted as falling on the next calendar day. */
  crossesMidnight: boolean;
  /** The resolved end date (YYYY-MM-DD) when `crossesMidnight` is true and `date` is known — for UI hints. */
  endDateLabel: string | null;
}

const VALID: ScheduleItemTimeOrderResult = {
  isValid: true,
  crossesMidnight: false,
  endDateLabel: null,
};

/**
 * Single canonical rule for interpreting an event schedule item's
 * date + startTime + endTime → whether the end is valid, and whether it
 * rolls into the next calendar day.
 *
 * - All-day items, or items missing either time, are always valid (nothing to order).
 * - An explicit multi-day range (`isMultiDay` with a `dateEnd` different from `date`)
 *   builds real start/end datetimes from `date+startTime` and `dateEnd+endTime` and
 *   compares those directly — endTime < startTime there is NOT treated as an
 *   automatic extra day, since the calendar days are already explicit.
 * - Otherwise (ordinary single-day item, or multi-day with no distinct end date),
 *   `endTime < startTime` means the event ends after midnight the next day.
 *   `endTime === startTime` stays invalid (not treated as a 24h event).
 */
export function resolveScheduleItemTimeOrder(
  item: ScheduleItemTimeOrderInput,
): ScheduleItemTimeOrderResult {
  if (item.allDay) return VALID;

  const startTime = item.startTime;
  const endTime = item.endTime;
  if (!startTime || !endTime) return VALID;

  const hasExplicitEndDate =
    Boolean(item.isMultiDay) &&
    isLocalDateString(item.date) &&
    isLocalDateString(item.dateEnd) &&
    item.dateEnd !== item.date;

  if (hasExplicitEndDate) {
    const startKey = `${item.date}T${startTime}`;
    const endKey = `${item.dateEnd}T${endTime}`;
    return {
      isValid: endKey > startKey,
      crossesMidnight: false,
      endDateLabel: null,
    };
  }

  if (endTime > startTime) return VALID;

  if (endTime < startTime) {
    return {
      isValid: true,
      crossesMidnight: true,
      endDateLabel: isLocalDateString(item.date) ? addDaysLocal(item.date, 1) : null,
    };
  }

  // endTime === startTime — not treated as a 24h event.
  return { isValid: false, crossesMidnight: false, endDateLabel: null };
}
