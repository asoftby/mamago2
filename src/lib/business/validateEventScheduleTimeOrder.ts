import { resolveScheduleItemTimeOrder } from "@/lib/event/scheduleItemTimeOrder";

interface ScheduleItemLike {
  date?: unknown;
  dateEnd?: unknown;
  isMultiDay?: unknown;
  allDay?: unknown;
  startTime?: unknown;
  endTime?: unknown;
}

/**
 * Server-side counterpart of the wizard's per-item time-order check in
 * `validation.ts` (`validateStep5`) — same canonical rule
 * (`resolveScheduleItemTimeOrder`), same error message, so a schedule the
 * client accepts can never be rejected here and vice versa. Checks every
 * `scheduleJson.scheduleItems[]` entry, not just the first.
 *
 * Deliberately wired into the submit gate only (final "ready to publish"
 * validation, same place as the title/description/cover-image checks it
 * sits next to), not into create/update: those persist in-progress drafts
 * and only ever feed `startTime` into `ActivitySession.startsAt` via
 * `extractScheduleDatesAndStartTime` (`materializeScheduleSessions.ts`) —
 * `endTime` order has no effect on stored session data before publish, so
 * there is nothing to protect there, and rejecting a mid-edit autosave for
 * a fleeting invalid state (e.g. equal start/end while typing) would be a
 * real regression outside this fix's scope.
 */
export function collectEventScheduleTimeOrderErrors(scheduleJson: unknown): string[] {
  const j =
    scheduleJson && typeof scheduleJson === "object" && !Array.isArray(scheduleJson)
      ? (scheduleJson as { scheduleItems?: unknown })
      : {};
  const items = Array.isArray(j.scheduleItems) ? (j.scheduleItems as unknown[]) : [];

  const errors: string[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as ScheduleItemLike;
    const order = resolveScheduleItemTimeOrder({
      date: typeof item.date === "string" ? item.date : null,
      dateEnd: typeof item.dateEnd === "string" ? item.dateEnd : null,
      isMultiDay: Boolean(item.isMultiDay),
      allDay: Boolean(item.allDay),
      startTime: typeof item.startTime === "string" ? item.startTime : null,
      endTime: typeof item.endTime === "string" ? item.endTime : null,
    });
    if (!order.isValid) {
      errors.push(
        typeof item.date === "string"
          ? `Время окончания должно отличаться от времени начала (дата ${item.date})`
          : "Время окончания должно отличаться от времени начала",
      );
    }
  }
  return errors;
}
