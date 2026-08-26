import { addDaysLocal } from "@/lib/date/localDateKey";

export const DEFAULT_NOTIFICATION_TIME_ZONE = "Europe/Minsk";
export const DEFAULT_PLAN_EVENING_TIME = "19:00";
export const DEFAULT_PLAN_REMINDER_OFFSET_MINUTES = 120;
export const USER_PLAN_REMINDER_OFFSETS = [30, 60, 120, 180] as const;
export const ADMIN_PLAN_REMINDER_OFFSETS = [5, 30, 60, 120, 180] as const;

export type NotificationTimeZoneMode = "AUTO" | "MANUAL";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function isValidLocalTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function getTimeZoneDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
}

function localPartsAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function zonedLocalDateTimeToUtc(
  dateKey: string,
  localTime: string,
  timeZone: string,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("INVALID_DATE_KEY");
  }
  if (!isValidLocalTime(localTime) || !isValidTimeZone(timeZone)) {
    throw new Error("INVALID_LOCAL_DATE_TIME");
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const desiredWallMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guessMs = desiredWallMs;

  for (let i = 0; i < 4; i += 1) {
    const observed = localPartsAt(new Date(guessMs), timeZone);
    const observedWallMs = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const correction = desiredWallMs - observedWallMs;
    guessMs += correction;
    if (correction === 0) break;
  }

  return new Date(guessMs);
}

export function computeNextPlanEveningRunAt(args: {
  now: Date;
  timeZone: string;
  localTime: string;
}): Date {
  const todayKey = getTimeZoneDateKey(args.now, args.timeZone);
  const todayCandidate = zonedLocalDateTimeToUtc(
    todayKey,
    args.localTime,
    args.timeZone,
  );
  if (todayCandidate.getTime() > args.now.getTime()) return todayCandidate;

  return zonedLocalDateTimeToUtc(
    addDaysLocal(todayKey, 1),
    args.localTime,
    args.timeZone,
  );
}

export function isPlanReminderOffsetAllowed(
  offsetMinutes: number,
  isAdmin: boolean,
): boolean {
  const allowed = isAdmin
    ? ADMIN_PLAN_REMINDER_OFFSETS
    : USER_PLAN_REMINDER_OFFSETS;
  return (allowed as readonly number[]).includes(offsetMinutes);
}

export function normalizePlanReminderOffset(
  offsetMinutes: number | null | undefined,
  isAdmin: boolean,
): number {
  return offsetMinutes !== null &&
    offsetMinutes !== undefined &&
    isPlanReminderOffsetAllowed(offsetMinutes, isAdmin)
    ? offsetMinutes
    : DEFAULT_PLAN_REMINDER_OFFSET_MINUTES;
}
