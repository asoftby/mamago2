import { localWallClockToUtc } from "@/lib/date/localDateKey";
import { extractScheduleDatesAndStartTime } from "@/lib/event/materializeScheduleSessions";

export type EventSessionTimezoneRepairEntry = {
  dateKey: string;
  legacyStartsAt: Date;
  desiredStartsAt: Date;
};

export type EventSessionTimezoneRepairPlan =
  | {
      kind: "already-correct";
      reason: string;
      entries: EventSessionTimezoneRepairEntry[];
    }
  | {
      kind: "legacy-utc-wall-clock";
      reason: string;
      entries: EventSessionTimezoneRepairEntry[];
    }
  | {
      kind: "unrelated-mismatch";
      reason: string;
      entries: EventSessionTimezoneRepairEntry[];
    };

function sameInstants(left: readonly Date[], right: readonly Date[]): boolean {
  if (left.length !== right.length) return false;
  const a = left.map((d) => d.getTime()).sort((x, y) => x - y);
  const b = right.map((d) => d.getTime()).sort((x, y) => x - y);
  return a.every((value, index) => value === b[index]);
}

/**
 * Reconstructs the specific legacy bug produced by a UTC-configured server:
 * schedule wall-clock digits were passed to `new Date(y, m, d, hh, mm)` and
 * therefore persisted as if those digits themselves were UTC.
 *
 * This is intentionally NOT a generic schedule/session reconciliation helper.
 * A repair is allowed only when the complete stored session set exactly
 * matches the instants that buggy UTC materialization would have produced.
 * Missing historical sessions, smoke-test rows, schedule edits and any other
 * mismatch are classified as unrelated and must not be rewritten here.
 */
export function buildEventSessionTimezoneRepairPlan(
  scheduleJson: unknown,
  sessions: readonly { startsAt: Date }[],
): EventSessionTimezoneRepairPlan {
  const { dates, startTime } = extractScheduleDatesAndStartTime(scheduleJson);
  const dateKeys = [...new Set(dates)].sort();

  if (dateKeys.length === 0) {
    return {
      kind: "unrelated-mismatch",
      reason: "schedule has no materialized dates",
      entries: [],
    };
  }

  const [hour, minute] = startTime.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return {
      kind: "unrelated-mismatch",
      reason: "schedule startTime is invalid",
      entries: [],
    };
  }

  const entries = dateKeys.map((dateKey) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return {
      dateKey,
      legacyStartsAt: new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!, 0, 0)),
      desiredStartsAt: localWallClockToUtc(dateKey, startTime),
    };
  });

  const actual = sessions.map((session) => session.startsAt);
  const desired = entries.map((entry) => entry.desiredStartsAt);
  if (sameInstants(actual, desired)) {
    return {
      kind: "already-correct",
      reason: "stored sessions already match explicit venue timezone",
      entries,
    };
  }

  const legacy = entries.map((entry) => entry.legacyStartsAt);
  if (sameInstants(actual, legacy) && !sameInstants(legacy, desired)) {
    return {
      kind: "legacy-utc-wall-clock",
      reason: "stored sessions exactly match legacy UTC wall-clock materialization",
      entries,
    };
  }

  return {
    kind: "unrelated-mismatch",
    reason: "session set differs from both correct and legacy timezone materialization",
    entries,
  };
}
