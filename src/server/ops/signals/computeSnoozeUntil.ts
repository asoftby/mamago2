/**
 * Snooze duration choices (§21 UI phase). A small finite set rather than
 * free-form datetime input, per the frozen UX spec.
 *
 * Belarus abolished DST in 2011 and stays on a fixed UTC+3 offset
 * year-round (same as Europe/Minsk, the app's canonical timezone for
 * calendar-day boundaries elsewhere — see resolvePerformanceWindow), so
 * "tomorrow" can use a fixed +3h offset without full IANA tz handling.
 */
const MINSK_UTC_OFFSET_HOURS = 3;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SNOOZE_CHOICES = ["1h", "tomorrow", "24h", "7d"] as const;
export type SnoozeChoice = (typeof SNOOZE_CHOICES)[number];

export function isSnoozeChoice(value: unknown): value is SnoozeChoice {
  return typeof value === "string" && (SNOOZE_CHOICES as readonly string[]).includes(value);
}

/** "Tomorrow" = next calendar day, 09:00 Europe/Minsk (= 06:00 UTC). */
function nextDayAt9amMinsk(now: Date): Date {
  const minskNow = new Date(now.getTime() + MINSK_UTC_OFFSET_HOURS * HOUR_MS);
  const nextDayUtcMidnight = Date.UTC(
    minskNow.getUTCFullYear(),
    minskNow.getUTCMonth(),
    minskNow.getUTCDate() + 1,
  );
  return new Date(nextDayUtcMidnight + 9 * HOUR_MS - MINSK_UTC_OFFSET_HOURS * HOUR_MS);
}

/** Pure — `now` must be a DB-derived instant, never browser/worker wall-clock. */
export function computeSnoozeUntil(now: Date, choice: SnoozeChoice): Date {
  switch (choice) {
    case "1h":
      return new Date(now.getTime() + HOUR_MS);
    case "24h":
      return new Date(now.getTime() + DAY_MS);
    case "7d":
      return new Date(now.getTime() + 7 * DAY_MS);
    case "tomorrow":
      return nextDayAt9amMinsk(now);
  }
}
