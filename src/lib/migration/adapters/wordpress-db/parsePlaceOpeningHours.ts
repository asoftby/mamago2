import type { DayOfWeek } from "@prisma/client";

import { ALL_DAYS } from "@/components/openingHours/openingHours.types";
import type { DayRule, OpeningHoursData, TimeInterval } from "@/components/openingHours/openingHours.types";

/**
 * `Europe/Minsk` matches `createDefaultUIState()`'s default
 * (`src/lib/openingHours/openingHoursMapper.ts`) and the Prisma model's own
 * column default — WP `work_hours` carries no timezone info of its own, so
 * there is nothing to derive; this is simply the product's one timezone.
 */
const TARGET_TIMEZONE = "Europe/Minsk";

export type PlaceOpeningHoursWarningCode =
  | "PLACE_WORK_HOURS_JSON_INVALID"
  | "PLACE_WORK_HOURS_STATUS_UNKNOWN"
  | "PLACE_WORK_HOURS_TIME_INVALID"
  | "PLACE_WORK_HOURS_DAY_INVALID"
  | "PLACE_WORK_HOURS_INTERVAL_OVERLAP"
  | "PLACE_WORK_HOURS_UNSUPPORTED"
  | "PLACE_WORK_HOURS_EMPTY";

export interface PlaceOpeningHoursWarning {
  code: PlaceOpeningHoursWarningCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ParsedPlaceOpeningHours {
  /**
   * `null` when there is no usable schedule at all: source missing/empty,
   * invalid JSON, or every day-group turned out unusable (unknown status,
   * "open" with zero hours evidence, etc.). Never a best-effort/fabricated
   * schedule — see individual warnings for why.
   */
  data: OpeningHoursData | null;
  warnings: readonly PlaceOpeningHoursWarning[];
  /**
   * Whatever `JSON.parse` produced (or the raw trimmed string, if parsing
   * itself failed) — kept for migration evidence, never used to build
   * `data`.
   */
  rawEvidence: unknown;
}

const SOURCE_DAY_TO_PRISMA: Record<string, DayOfWeek> = {
  mon: "MON",
  tue: "TUE",
  wed: "WED",
  thu: "THU",
  fri: "FRI",
  sat: "SAT",
  sun: "SUN",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const KNOWN_STATUSES = new Set(["hours", "appointments_only", "closed", "open"]);

interface SourceInterval {
  from?: unknown;
  to?: unknown;
}

interface SourceDayGroup {
  days?: unknown;
  status?: unknown;
  hours?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function closedDefault(day: DayOfWeek): DayRule {
  return { dayOfWeek: day, isOpen: false, allDay: false, intervals: [] };
}

/**
 * Parses one WordPress-Voxel `work_hours` postmeta value (a JSON array of
 * `{days, status, hours}` day-groups) into the canonical `OpeningHoursData`
 * shape already used by the real admin/business save path
 * (`src/lib/openingHours/openingHoursMapper.ts`) — so the migration writer
 * can hand the result straight to `mapToCreatePayload`/`mapToUpdatePayload`
 * instead of inventing a second Prisma-payload builder.
 *
 * Pure — no DB reads, no clock, no randomness, deterministic for identical
 * input. Never fabricates a schedule: every warning code documents exactly
 * why a piece of source data didn't make it into `data`.
 *
 * Mapping decisions (see `docs/migration/prelaunch-checklist.md` §1 Places
 * for the full writeup):
 * - `status: "closed"` for a day -> `DayRule.isOpen: false` for that day —
 *   even when *every* day is "closed", this still maps to `mode: "WEEKLY"`
 *   with 7 closed days, never `mode: "TEMPORARILY_CLOSED"`. That mode's
 *   public text (`getOpeningStatus()`) asserts "Временно закрыто" — a
 *   specific business-status claim WP's per-day schedule data never makes;
 *   `TEMPORARILY_CLOSED` is reserved for an explicit admin action.
 * - `status: "appointments_only"` covering the *entire* week (and nothing
 *   else assigned) -> `mode: "BY_APPOINTMENT"`. Mixed with real hours on
 *   other days (never observed in the live 77-place dataset, but handled
 *   deterministically) -> those appointment days are dropped with a
 *   `PLACE_WORK_HOURS_UNSUPPORTED` warning; the model has no per-day
 *   appointments-only flag to represent that mix.
 * - `status: "open"` is only ever used when its `hours` array is non-empty
 *   and valid — never auto-mapped to `mode: "ALWAYS_OPEN"` (24/7) just
 *   because the source says "open" with no interval evidence. The one real
 *   occurrence (WP 30411) has `hours: []` and is reported as
 *   `PLACE_WORK_HOURS_UNSUPPORTED`.
 * - Overnight intervals (`to <= from`, e.g. `10:00`–`00:00`) are reported as
 *   `PLACE_WORK_HOURS_UNSUPPORTED`, not stored verbatim: traced
 *   `src/server/services/openingHours/openingHours.utils.ts`'s
 *   `compareTime`/`isTimeInInterval` — they do a plain HH:MM comparison
 *   with no midnight rollover, so a stored `10:00`–`00:00` interval would
 *   silently make `isOpenNow()`/`getOpeningStatus()` report "closed" for
 *   the entire overnight window. Storing it would be a silent correctness
 *   bug, worse than omitting it.
 */
export function parsePlaceOpeningHours(workHoursRaw: string | null): ParsedPlaceOpeningHours {
  const trimmed = workHoursRaw?.trim();
  if (!trimmed) {
    return { data: null, warnings: [], rawEvidence: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      data: null,
      warnings: [
        {
          code: "PLACE_WORK_HOURS_JSON_INVALID",
          message: "work_hours value is not valid JSON.",
          details: { raw: trimmed },
        },
      ],
      rawEvidence: trimmed,
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      data: null,
      warnings: [
        {
          code: "PLACE_WORK_HOURS_JSON_INVALID",
          message: "work_hours JSON must be an array of day-group objects.",
          details: { parsedType: typeof parsed },
        },
      ],
      rawEvidence: parsed,
    };
  }

  if (parsed.length === 0) {
    return {
      data: null,
      warnings: [{ code: "PLACE_WORK_HOURS_EMPTY", message: "work_hours is present but an empty array." }],
      rawEvidence: parsed,
    };
  }

  const warnings: PlaceOpeningHoursWarning[] = [];
  const assignedDays = new Map<DayOfWeek, DayRule>();
  let appointmentDayCount = 0;

  for (const rawGroup of parsed) {
    if (!isPlainObject(rawGroup)) {
      warnings.push({
        code: "PLACE_WORK_HOURS_JSON_INVALID",
        message: "A work_hours entry is not an object.",
        details: { entry: rawGroup },
      });
      continue;
    }
    const group = rawGroup as SourceDayGroup;

    const rawDays = Array.isArray(group.days) ? group.days : [];
    const validDays: DayOfWeek[] = [];
    for (const rawDay of rawDays) {
      const key = typeof rawDay === "string" ? rawDay.toLowerCase() : "";
      const mapped = SOURCE_DAY_TO_PRISMA[key];
      if (!mapped) {
        warnings.push({
          code: "PLACE_WORK_HOURS_DAY_INVALID",
          message: `Unrecognized day token "${String(rawDay)}".`,
          details: { day: rawDay },
        });
        continue;
      }
      validDays.push(mapped);
    }

    const status = typeof group.status === "string" ? group.status : "";
    if (!KNOWN_STATUSES.has(status)) {
      warnings.push({
        code: "PLACE_WORK_HOURS_STATUS_UNKNOWN",
        message: `Unrecognized work_hours status "${status}".`,
        details: { status, days: validDays },
      });
      continue;
    }

    if (status === "appointments_only") {
      appointmentDayCount += validDays.length;
      continue;
    }

    let rule: Omit<DayRule, "dayOfWeek"> | null = null;

    if (status === "closed") {
      rule = { isOpen: false, allDay: false, intervals: [] };
    } else {
      // "hours" or "open"
      const rawIntervals = Array.isArray(group.hours) ? group.hours : [];
      const validIntervals: TimeInterval[] = [];
      for (const rawInterval of rawIntervals) {
        if (!isPlainObject(rawInterval)) {
          warnings.push({
            code: "PLACE_WORK_HOURS_TIME_INVALID",
            message: "A work_hours interval is not an object.",
            details: { interval: rawInterval },
          });
          continue;
        }
        const iv = rawInterval as SourceInterval;
        const from = typeof iv.from === "string" ? iv.from : "";
        const to = typeof iv.to === "string" ? iv.to : "";
        if (!TIME_RE.test(from) || !TIME_RE.test(to)) {
          warnings.push({
            code: "PLACE_WORK_HOURS_TIME_INVALID",
            message: `Invalid time interval "${from}"–"${to}".`,
            details: { from, to },
          });
          continue;
        }
        if (to <= from) {
          warnings.push({
            code: "PLACE_WORK_HOURS_UNSUPPORTED",
            message: `Overnight interval "${from}"–"${to}" is not supported by the target model's isOpenNow() logic.`,
            details: { from, to },
          });
          continue;
        }
        validIntervals.push({ startTime: from, endTime: to });
      }

      if (status === "open" && rawIntervals.length === 0) {
        warnings.push({
          code: "PLACE_WORK_HOURS_UNSUPPORTED",
          message: '"open" status has no hours evidence — never auto-mapped to 24/7 without proof.',
          details: { days: validDays },
        });
        continue;
      }

      if (validIntervals.length === 0) {
        // Every interval for this group was invalid/overnight — nothing
        // usable survived, and every rejection was already warned above.
        continue;
      }

      rule = { isOpen: true, allDay: false, intervals: validIntervals };
    }

    for (const day of validDays) {
      if (assignedDays.has(day)) {
        warnings.push({
          code: "PLACE_WORK_HOURS_INTERVAL_OVERLAP",
          message: `Day "${day}" is assigned by more than one work_hours entry; the first assignment is kept.`,
          details: { day },
        });
        continue;
      }
      assignedDays.set(day, { ...rule!, dayOfWeek: day });
    }
  }

  if (appointmentDayCount === 7 && assignedDays.size === 0) {
    return {
      data: { mode: "BY_APPOINTMENT", timezone: TARGET_TIMEZONE, rules: [] },
      warnings,
      rawEvidence: parsed,
    };
  }

  if (assignedDays.size > 0) {
    if (appointmentDayCount > 0) {
      warnings.push({
        code: "PLACE_WORK_HOURS_UNSUPPORTED",
        message:
          "appointments_only mixed with a real weekly schedule on other days is not representable per-day by the target model; those days are left without hours.",
        details: { appointmentDayCount },
      });
    }
    return {
      data: {
        mode: "WEEKLY",
        timezone: TARGET_TIMEZONE,
        rules: ALL_DAYS.map((day) => assignedDays.get(day) ?? closedDefault(day)),
      },
      warnings,
      rawEvidence: parsed,
    };
  }

  if (appointmentDayCount > 0) {
    warnings.push({
      code: "PLACE_WORK_HOURS_UNSUPPORTED",
      message: "appointments_only does not cover the full week and no other schedule data exists.",
      details: { appointmentDayCount },
    });
  }

  return { data: null, warnings, rawEvidence: parsed };
}
