import type { DateRange } from "./types";
import type { DateRangeMode, OngoingTemporalPolicy } from "./ongoingPolicy";
import { DEFAULT_ONGOING_TEMPORAL_POLICY } from "./ongoingPolicy";

/**
 * Instant ∈ half-open [start, end).
 * Used for ActivitySession.startsAt / OfferSession.startAt / nextOccurrenceAt.
 */
export function occurrenceBelongsToRange(instant: Date, range: DateRange): boolean {
  const t = instant.getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

export type OngoingWindow = {
  dateFrom: Date | null;
  dateTo: Date | null;
};

/**
 * Whether an availability window belongs to a temporal slot under `policy`.
 *
 * Overlap alone is NOT membership for ongoing — policy decides.
 * - always: classic overlap with the slot range
 * - never: false
 * - boundary: window opens or closes inside the slot range
 */
export function ongoingBelongsToRange(
  window: OngoingWindow,
  range: DateRange,
  policy: OngoingTemporalPolicy = DEFAULT_ONGOING_TEMPORAL_POLICY,
): boolean {
  if (policy === "never") return false;
  if (!window.dateFrom && !window.dateTo) return false;

  if (policy === "boundary") {
    const opensInside =
      window.dateFrom != null && occurrenceBelongsToRange(window.dateFrom, range);
    const closesInside =
      window.dateTo != null && occurrenceBelongsToRange(window.dateTo, range);
    return opensInside || closesInside;
  }

  // policy === "always": overlap
  // [from, to] overlaps [start, end) iff from < end && (to == null || to >= start)
  // Treat missing dateTo as open-ended; missing dateFrom as open-started.
  const fromOk = window.dateFrom == null || window.dateFrom.getTime() < range.end.getTime();
  const toOk = window.dateTo == null || window.dateTo.getTime() >= range.start.getTime();
  return fromOk && toOk;
}

export type DateRangeWhereOptions = {
  /** Required when mode === "ongoing". Default: always. */
  ongoingPolicy?: OngoingTemporalPolicy;
  /**
   * Prisma field names for the instant / window.
   * Defaults match ActivitySession / Offer date columns.
   */
  occurrenceField?: string;
  dateFromField?: string;
  dateToField?: string;
};

/**
 * Build an explicit Prisma-shaped where fragment for a date range.
 *
 * Two modes — never conflate:
 * - `occurrence`: point-in-time field ∈ [start, end)
 * - `ongoing`: availability window vs slot, gated by {@link OngoingTemporalPolicy}
 *
 * `tz` is accepted for future calendar-day coercion of date-only columns;
 * instant comparisons use the absolute `range` bounds (already TZ-derived).
 */
export function buildDateRangeWhere(
  range: DateRange,
  _tz: string,
  mode: DateRangeMode,
  options: DateRangeWhereOptions = {},
): Record<string, unknown> {
  void _tz;

  if (mode === "occurrence") {
    const field = options.occurrenceField ?? "startsAt";
    return {
      [field]: {
        gte: range.start,
        lt: range.end,
      },
    };
  }

  const policy = options.ongoingPolicy ?? DEFAULT_ONGOING_TEMPORAL_POLICY;
  const fromField = options.dateFromField ?? "dateFrom";
  const toField = options.dateToField ?? "dateTo";

  if (policy === "never") {
    // Unsatisfiable — caller may skip the query entirely.
    return { id: { in: [] } };
  }

  if (policy === "boundary") {
    return {
      OR: [
        {
          AND: [
            { [fromField]: { not: null } },
            { [fromField]: { gte: range.start, lt: range.end } },
          ],
        },
        {
          AND: [
            { [toField]: { not: null } },
            { [toField]: { gte: range.start, lt: range.end } },
          ],
        },
      ],
    };
  }

  // always — overlap
  return {
    AND: [
      {
        OR: [{ [fromField]: null }, { [fromField]: { lt: range.end } }],
      },
      {
        OR: [{ [toField]: null }, { [toField]: { gte: range.start } }],
      },
      // At least one bound present (avoid matching empty windows)
      {
        OR: [{ [fromField]: { not: null } }, { [toField]: { not: null } }],
      },
    ],
  };
}

/** OfferSession uses startAt, not startsAt. */
export function buildOfferSessionOccurrenceWhere(range: DateRange, tz: string) {
  return buildDateRangeWhere(range, tz, "occurrence", {
    occurrenceField: "startAt",
  });
}
