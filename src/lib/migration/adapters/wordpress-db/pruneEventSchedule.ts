import type { NormalizedEventScheduleDraft } from "./normalizeEvent";

const DEFAULT_TIME_ZONE = "Europe/Minsk";

type ScheduleItem = NonNullable<NormalizedEventScheduleDraft["scheduleItems"]>[number];

export interface EventSchedulePruneEligible {
  eligible: true;
  scheduleDraft: NormalizedEventScheduleDraft;
  droppedPastDates: readonly string[];
}

export interface EventSchedulePruneIneligible {
  eligible: false;
  droppedPastDates: readonly string[];
}

export type EventSchedulePruneResult = EventSchedulePruneEligible | EventSchedulePruneIneligible;

/** `now` formatted as a `YYYY-MM-DD` local-date key in `timeZone` — the local-day boundary used to decide "past" vs "active/future". */
export function localDateKeyInTimeZone(now: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Prunes a schedule draft down to sessions that are active or future
 * relative to `now`'s local day in `timeZone` — Phoenix v1 excludes past
 * Events entirely (prelaunch-checklist §0.6). A session counts as
 * active/future if its start date is on/after today's local date, or (for a
 * date range) its end date is on/after today — an interval already
 * underway still counts as active, matching today-is-not-past semantics.
 * If nothing survives pruning, the event is ineligible for migration
 * (all sessions were past-only).
 */
export function pruneEventScheduleToEligibleSessions(input: {
  scheduleDraft: NormalizedEventScheduleDraft;
  now: Date;
  timeZone?: string;
}): EventSchedulePruneResult {
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;
  const todayKey = localDateKeyInTimeZone(input.now, timeZone);

  const items = input.scheduleDraft.scheduleItems ?? [];
  const seen = new Set<string>();
  const retainedItems: ScheduleItem[] = [];
  const droppedPastDates: string[] = [];

  for (const item of items) {
    const isActiveOrFuture = item.date >= todayKey || (item.dateEnd !== undefined && item.dateEnd >= todayKey);
    if (!isActiveOrFuture) {
      droppedPastDates.push(item.date);
      continue;
    }
    const dedupeKey = `${item.date}|${item.dateEnd ?? ""}|${item.startTime ?? ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    retainedItems.push(item);
  }

  retainedItems.sort((a, b) => a.date.localeCompare(b.date));

  if (retainedItems.length === 0) {
    return { eligible: false, droppedPastDates };
  }

  const retainedDates = [
    ...new Set(retainedItems.flatMap((item) => (item.dateEnd ? [item.date, item.dateEnd] : [item.date]))),
  ].sort((a, b) => a.localeCompare(b));
  const firstStartTime = retainedItems.find((item) => item.startTime)?.startTime;

  return {
    eligible: true,
    scheduleDraft: {
      mode: retainedItems.length === 1 ? "ONE_TIME" : "MULTI_DATE",
      dates: retainedDates,
      scheduleItems: retainedItems,
      ...(firstStartTime ? { startTime: firstStartTime } : {}),
    },
    droppedPastDates,
  };
}
