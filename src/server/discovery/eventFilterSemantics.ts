import type { Prisma } from "@prisma/client";
import { addDateKeyDays, weekdayFromDateKey, zonedDateKey, zonedDayRange } from "@/lib/stories/ranges";
import type { DateRange } from "@/lib/stories/types";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
export { EVENT_EXECUTABLE_FILTER_KEYS, isExecutableEventFilterKey } from "@/lib/discovery/executableFilterRegistry";
export type { EventExecutableFilterKey } from "@/lib/discovery/executableFilterRegistry";

export type EventDateSelection = {
  preset?: "TODAY" | "TOMORROW" | "WEEKEND" | null;
  from?: string | null;
  to?: string | null;
};

function isDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year!, month! - 1, day!, 12));
  return check.toISOString().slice(0, 10) === value;
}

export function resolveEventDateRange(
  selection: EventDateSelection,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TZ,
): DateRange | null {
  const todayKey = zonedDateKey(now, timeZone);

  if (selection.preset === "TODAY") return zonedDayRange(todayKey, 1, timeZone);
  if (selection.preset === "TOMORROW") {
    return zonedDayRange(addDateKeyDays(todayKey, 1), 1, timeZone);
  }
  if (selection.preset === "WEEKEND") {
    const weekday = weekdayFromDateKey(todayKey);
    if (weekday === 6) return zonedDayRange(todayKey, 2, timeZone);
    if (weekday === 0) return zonedDayRange(todayKey, 1, timeZone);
    return zonedDayRange(addDateKeyDays(todayKey, 6 - weekday), 2, timeZone);
  }

  if (!isDateKey(selection.from)) return null;
  const endKey = isDateKey(selection.to) && selection.to >= selection.from
    ? addDateKeyDays(selection.to, 1)
    : addDateKeyDays(selection.from, 1);
  return {
    start: zonedDayRange(selection.from, 1, timeZone).start,
    end: zonedDayRange(endKey, 1, timeZone).start,
  };
}

export type EventRuntimeFilters = {
  dateRange: DateRange | null;
  free: boolean;
  districtId: string | null;
  metroId: string | null;
};

export function buildEffectivePlaceDistrictWhere(districtId: string): Prisma.PlaceWhereInput {
  return {
    OR: [
      { districtManualId: districtId },
      { districtManualId: null, districtAutoId: districtId },
    ],
  };
}

export function buildEffectivePlaceMetroWhere(metroId: string): Prisma.PlaceWhereInput {
  return {
    OR: [
      { metroManualId: metroId },
      { metroManualId: null, metroAutoId: metroId },
    ],
  };
}

/**
 * Event Wizard stores `scheduleJson.pricingMode="free"`; import normalization
 * stores structured numeric zero. Both are authoritative structured states.
 * Null/unset price without the explicit pricing mode is not free.
 */
export function buildFreeEventWhere(): Prisma.ActivityWhereInput {
  return {
    OR: [
      { priceFrom: 0 },
      { scheduleJson: { path: ["pricingMode"], equals: "free" } },
    ],
  };
}

export function isStructuredFreeEvent(input: {
  priceFrom: number | null;
  scheduleJson?: unknown;
}): boolean {
  if (input.priceFrom === 0) return true;
  if (!input.scheduleJson || typeof input.scheduleJson !== "object") return false;
  return (input.scheduleJson as { pricingMode?: unknown }).pricingMode === "free";
}

export function buildEventRuntimeWhere(filters: EventRuntimeFilters): Prisma.ActivityWhereInput[] {
  const parts: Prisma.ActivityWhereInput[] = [];
  if (filters.dateRange) {
    parts.push({
      sessions: {
        some: {
          startsAt: { gte: filters.dateRange.start, lt: filters.dateRange.end },
        },
      },
    });
  }
  if (filters.free) parts.push(buildFreeEventWhere());
  if (filters.districtId) {
    parts.push({ place: { is: buildEffectivePlaceDistrictWhere(filters.districtId) } });
  }
  if (filters.metroId) {
    parts.push({ place: { is: buildEffectivePlaceMetroWhere(filters.metroId) } });
  }
  return parts;
}
