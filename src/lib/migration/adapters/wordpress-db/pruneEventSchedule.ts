import type { NormalizedEventScheduleDraft } from "./normalizeEvent";

const DEFAULT_TIME_ZONE = "Europe/Minsk";

type ScheduleItem = NonNullable<NormalizedEventScheduleDraft["scheduleItems"]>[number];

export interface EventActiveRangeClamp {
  originalStartDate: string;
  clampedStartDate: string;
  endDate: string;
  droppedPastDayCount: number;
}

export interface EventSchedulePruneEligible {
  eligible: true;
  scheduleDraft: NormalizedEventScheduleDraft;
  droppedPastDates: readonly string[];
  /** Ranges that were already underway (start in the past, end today/future) — their start was clamped to today's local date rather than dropped or left in the past. */
  clampedActiveRanges: readonly EventActiveRangeClamp[];
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

/** Exact calendar-day count from `fromKey` to `toKey` (both `YYYY-MM-DD`) — UTC-constructed so DST never perturbs the diff, since these are pure date keys, not instants. */
function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const fromUtc = Date.UTC(fy!, fm! - 1, fd!);
  const toUtc = Date.UTC(ty!, tm! - 1, td!);
  return Math.round((toUtc - fromUtc) / 86_400_000);
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
 *
 * A range whose start is in the past but whose end is today/future is kept,
 * not dropped — but its *start* is clamped to today's local date first.
 * Without this, the unmodified past start survives into
 * `EventCommitWriter`'s `replaceActivitySessionsFromScheduleJson`, which
 * calls the shared `expandScheduleItemDates()` (used as-is — the Business
 * Wizard depends on it expanding an already-normalized range correctly) and
 * materializes one `ActivitySession` per day of the *original* range,
 * including every past day — silently violating the "past Events/sessions
 * are never migrated" invariant this whole module exists to enforce.
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
  const clampedActiveRanges: EventActiveRangeClamp[] = [];

  for (const item of items) {
    const hasRange = item.dateEnd !== undefined;
    const rangeEnd = item.dateEnd ?? item.date;
    const isActiveOrFuture = item.date >= todayKey || (hasRange && rangeEnd >= todayKey);
    if (!isActiveOrFuture) {
      droppedPastDates.push(item.date);
      continue;
    }

    let effectiveItem = item;
    if (hasRange && item.date < todayKey) {
      clampedActiveRanges.push({
        originalStartDate: item.date,
        clampedStartDate: todayKey,
        endDate: rangeEnd,
        droppedPastDayCount: daysBetweenDateKeys(item.date, todayKey),
      });
      effectiveItem =
        todayKey === rangeEnd
          ? { date: todayKey, ...(item.startTime ? { startTime: item.startTime } : {}) }
          : { ...item, date: todayKey };
    }

    const dedupeKey = `${effectiveItem.date}|${effectiveItem.dateEnd ?? ""}|${effectiveItem.startTime ?? ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    retainedItems.push(effectiveItem);
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
    clampedActiveRanges,
  };
}
