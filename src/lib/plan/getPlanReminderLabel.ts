import { differenceInMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import {
  DEFAULT_PLAN_REMINDER_POLICY,
  type PlanReminderPolicy,
} from "./planReminderPolicy";

export const PLAN_REMINDER_LABELS = {
  twoHoursBefore: "напомним за 2 часа",
  startingSoon: "событие скоро начнётся",
  eveningBefore: "напомним накануне вечером",
  tomorrowMorning: "напомним завтра утром",
  tonight: "напомним сегодня вечером",
  alreadyPlanned: "уже в плане",
} as const;

export type PlanReminderLabel = (typeof PLAN_REMINDER_LABELS)[keyof typeof PLAN_REMINDER_LABELS];

export type GetPlanReminderLabelInput = {
  now?: Date;
  eventDateTime: Date;
  timeZone?: string;
  reminderPolicy?: PlanReminderPolicy;
};

function getZonedHour(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(date);
  return Number(hour);
}

function calendarDayDiff(now: Date, event: Date, timeZone: string): number {
  const nowKey = getLocalDateKey(now, timeZone);
  const eventKey = getLocalDateKey(event, timeZone);
  const [ny, nm, nd] = nowKey.split("-").map(Number);
  const [ey, em, ed] = eventKey.split("-").map(Number);
  const nowUtc = Date.UTC(ny!, (nm ?? 1) - 1, nd ?? 1);
  const eventUtc = Date.UTC(ey!, (em ?? 1) - 1, ed ?? 1);
  return Math.round((eventUtc - nowUtc) / (24 * 60 * 60 * 1000));
}

/** Builds an absolute event timestamp from plan row fields. */
export function resolvePlanEventDateTime(
  planDate: string,
  planStartsAt?: string | null,
  timeZone: string = DEFAULT_TZ,
): Date {
  if (planStartsAt) return new Date(planStartsAt);
  return fromZonedTime(`${planDate}T12:00:00`, timeZone);
}

/** Parses a local date/time in the product timezone (for tests and fixtures). */
export function parsePlanDateTimeInTz(
  date: string,
  time = "12:00",
  timeZone: string = DEFAULT_TZ,
): Date {
  const [h, m = "0"] = time.split(":");
  const hh = h!.padStart(2, "0");
  const mm = m.padStart(2, "0");
  return fromZonedTime(`${date}T${hh}:${mm}:00`, timeZone);
}

/**
 * Human-readable reminder caption for a saved plan item.
 * Returns `null` when the reminder line should be hidden (past event).
 */
export function getPlanReminderLabel({
  now = new Date(),
  eventDateTime,
  timeZone = DEFAULT_TZ,
  reminderPolicy,
}: GetPlanReminderLabelInput): PlanReminderLabel | null {
  const policy = { ...DEFAULT_PLAN_REMINDER_POLICY, ...reminderPolicy };

  if (eventDateTime.getTime() <= now.getTime()) {
    return null;
  }

  const dayDiff = calendarDayDiff(now, eventDateTime, timeZone);

  if (dayDiff === 0) {
    const minutesLeft = differenceInMinutes(eventDateTime, now);
    if (minutesLeft > policy.sameDayLeadMinutes) {
      return PLAN_REMINDER_LABELS.twoHoursBefore;
    }
    return PLAN_REMINDER_LABELS.startingSoon;
  }

  if (dayDiff === 1) {
    const eventHour = getZonedHour(eventDateTime, timeZone);
    const nowHour = getZonedHour(now, timeZone);

    if (eventHour < policy.morningEventCutoffHour) {
      if (nowHour < policy.lateEveningCutoffHour) {
        return PLAN_REMINDER_LABELS.tonight;
      }
      return PLAN_REMINDER_LABELS.tomorrowMorning;
    }

    if (nowHour < policy.tomorrowEveningCutoffHour) {
      return PLAN_REMINDER_LABELS.eveningBefore;
    }
    return PLAN_REMINDER_LABELS.tomorrowMorning;
  }

  return PLAN_REMINDER_LABELS.eveningBefore;
}

export function getPlanReminderLabelFromPlanItem(args: {
  now?: Date;
  planDate: string;
  planStartsAt?: string | null;
  timeZone?: string;
  reminderPolicy?: PlanReminderPolicy;
}): PlanReminderLabel | null {
  return getPlanReminderLabel({
    now: args.now,
    eventDateTime: resolvePlanEventDateTime(args.planDate, args.planStartsAt, args.timeZone),
    timeZone: args.timeZone,
    reminderPolicy: args.reminderPolicy,
  });
}

export function formatPlanReminderBullet(label: PlanReminderLabel | null): string | null {
  if (!label) return null;
  return `● ${label}`;
}
