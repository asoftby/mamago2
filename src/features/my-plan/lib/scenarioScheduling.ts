import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { resolveScheduleItemTimeOrder } from "@/lib/event/scheduleItemTimeOrder";
import type { ScenarioItemTiming } from "./scenarioProjection";

export type ScenarioSchedulingKind = "SLOT" | "WINDOW" | "UNKNOWN";

export type ScenarioScheduling = {
  kind: ScenarioSchedulingKind;
  startsAt: Date | null;
  endsAt: Date | null;
  durationMinutes: number | null;
  canReschedule: boolean;
};

type SchedulingActivity = {
  schedulingKind: "SLOT" | "WINDOW" | null;
  scheduleJson: unknown;
} | null;

type ScheduleItem = {
  date?: unknown;
  dateEnd?: unknown;
  isMultiDay?: unknown;
  allDay?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function scheduleRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function localTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function validDurationMinutes(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 600
    ? value
    : null;
}

function endFromExactScheduleItem(
  startsAt: Date,
  scheduleJson: Record<string, unknown>,
): Date | null {
  if (!Array.isArray(scheduleJson.scheduleItems)) return null;

  const date = getLocalDateKey(startsAt);
  const time = localTime(startsAt);
  const items = scheduleJson.scheduleItems as ScheduleItem[];
  const exactMatches = items.filter(
    (item) => item.date === date &&
      (typeof item.dateEnd !== "string" || item.dateEnd === date) &&
      item.startTime === time,
  );
  const rangeMatches = items.filter(
    (item) => typeof item.date === "string" && typeof item.dateEnd === "string" &&
      DATE_PATTERN.test(item.date) && DATE_PATTERN.test(item.dateEnd) &&
      item.date < item.dateEnd && item.date <= date && date <= item.dateEnd &&
      item.startTime === time,
  );
  // Exact single-day records always win. Ambiguity at either priority is
  // incomplete data, not a reason to choose an arbitrary row.
  const matches = exactMatches.length > 0 ? exactMatches : rangeMatches;
  if (matches.length !== 1) return null;

  const item = matches[0]!;
  if (item.allDay === true || typeof item.endTime !== "string" || !TIME_PATTERN.test(item.endTime)) {
    return null;
  }

  const order = resolveScheduleItemTimeOrder({
    date,
    dateEnd: typeof item.dateEnd === "string" ? item.dateEnd : null,
    isMultiDay: item.isMultiDay === true,
    allDay: false,
    startTime: time,
    endTime: item.endTime,
  });
  if (!order.isValid) return null;

  const endDate =
    item.isMultiDay === true && typeof item.dateEnd === "string" && item.dateEnd !== date
      ? item.dateEnd
      : order.crossesMidnight
        ? addDaysLocal(date, 1)
        : date;
  const endsAt = localWallClockToUtc(endDate, item.endTime);
  return endsAt.getTime() > startsAt.getTime() ? endsAt : null;
}

function endFromImportedRange(
  startsAt: Date,
  scheduleJson: Record<string, unknown>,
): Date | null {
  if (typeof scheduleJson.startAt !== "string" || typeof scheduleJson.endAt !== "string") {
    return null;
  }
  const importedStart = new Date(scheduleJson.startAt);
  const importedEnd = new Date(scheduleJson.endAt);
  if (Number.isNaN(importedStart.getTime()) || Number.isNaN(importedEnd.getTime())) return null;
  if (importedStart.getTime() !== startsAt.getTime() || importedEnd.getTime() <= startsAt.getTime()) {
    return null;
  }
  return importedEnd;
}

export function resolveScenarioScheduling(input: {
  activity: SchedulingActivity;
  timing: ScenarioItemTiming;
}): ScenarioScheduling {
  const kind: ScenarioSchedulingKind = input.activity?.schedulingKind ?? "UNKNOWN";
  const startsAt = input.timing.effectiveStartsAt;
  const scheduleJson = scheduleRecord(input.activity?.scheduleJson);
  const configuredDuration = validDurationMinutes(scheduleJson?.durationMinutes);

  let endsAt: Date | null = null;
  if (startsAt && scheduleJson) {
    endsAt = endFromExactScheduleItem(startsAt, scheduleJson);
    if (!endsAt && configuredDuration != null) {
      endsAt = new Date(startsAt.getTime() + configuredDuration * 60_000);
    }
    if (!endsAt) endsAt = endFromImportedRange(startsAt, scheduleJson);
  }

  const durationMinutes =
    startsAt && endsAt
      ? Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
      : configuredDuration;

  return {
    kind,
    startsAt,
    endsAt,
    durationMinutes,
    canReschedule: kind !== "UNKNOWN" && input.timing.isFlexible,
  };
}
