import { DEFAULT_TZ } from "@/server/geo/geoConstants";

export function getLocalDateKey(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TZ,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDaysLocal(input: string | Date, days: number): string {
  const base = typeof input === "string" ? parseLocalDateKey(input) : new Date(input);
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + days);
  return getLocalDateKey(next);
}

export function formatLocalPlanDate(
  dateKey: string,
  locale: string = "ru-BY",
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(parseLocalDateKey(dateKey));
}

/**
 * Converts a "HH:MM" wall-clock time on a given local date into the correct
 * UTC instant for `timeZone` — deterministic regardless of the executing
 * process's own OS timezone. Unlike `new Date(\`${date}T${time}:00\`)`
 * (which silently uses the *process's* local time and only happens to be
 * correct when that matches `timeZone`; on a UTC-configured DEV container
 * this produced a real several-hour drift, confirmed via real-DEV smoke),
 * this never re-parses a formatted string with `new Date(...)` — that would
 * reintroduce the exact same ambient-timezone dependency (re-parsing via
 * `toLocaleString` + `new Date()` was tried first and silently "worked" only
 * because the dev machine's own OS timezone happened to equal `timeZone`).
 * Instead it uses the standard library-free technique: guess the instant by
 * treating the wall-clock digits as UTC, ask `Intl.DateTimeFormat` what that
 * instant reads as in `timeZone`, and correct by the difference — every step
 * either explicit UTC math (`Date.UTC`) or an explicit-`timeZone` Intl call,
 * never ambient. Handles any DST the zone might have, though `DEFAULT_TZ`
 * (Europe/Minsk) currently has none.
 */
export function localWallClockToUtc(
  dateKey: string,
  time: string,
  timeZone: string = DEFAULT_TZ,
): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const guessUtcMs = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guessUtcMs));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);

  const zonedReadingAsUtcMs = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );

  const offsetMs = zonedReadingAsUtcMs - guessUtcMs;
  return new Date(guessUtcMs - offsetMs);
}
