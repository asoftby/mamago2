import type { BookingMode, ScheduleKind } from "@prisma/client";
import {
  dateKeyInZone,
  isoWeekday,
  localMinuteKey,
  localMinuteToUtc,
  parseClockMinutes,
  shiftDateKey,
} from "./slotTime";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const SLOT_STEP_MINUTES = 15;
const DAY_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export type Slot = {
  startsAt: Date;
  endsAt: Date;
  remainingSeats: number | null;
  unitIds: string[];
  sessionId?: string;
};

export type GetSlotsInput = {
  offerId: string;
  from: Date;
  to: Date;
  requestedSeats?: number;
};

type LocalInterval = { startMinutes: number; endMinutes: number };
type UtcInterval = { start: Date; end: Date };

export type SlotSnapshot = {
  mode: BookingMode | null;
  scheduleKind: ScheduleKind | null;
  timezone: string;
  leadTimeHours: number;
  horizonDays: number;
  durationMin: number | null;
  bufferMin: number;
  capacity: number | null;
  rules: Array<{
    weekday: number;
    startMinutes: number;
    endMinutes: number;
    validFrom: string | null;
    validTo: string | null;
    capacity: number | null;
  }>;
  closedDates: string[];
  sessions: Array<{
    id: string;
    startAt: Date;
    endAt: Date;
    capacity: number | null;
    isCancelled: boolean;
  }>;
  requests: Array<{
    offerSessionId: string | null;
    startsAt: Date | null;
    seats: number;
    status: "NEW" | "CONFIRMED";
    holdUntil: Date | null;
    campShiftDateFrom?: Date | null;
    campShiftDateTo?: Date | null;
    childrenCount?: number;
  }>;
  openingHours: {
    mode: "WEEKLY" | "ALWAYS_OPEN" | "BY_APPOINTMENT" | "TEMPORARILY_CLOSED";
    timezone: string;
    rules: Array<{
      dayOfWeek: string;
      isOpen: boolean;
      allDay: boolean;
      intervals: Array<{ startTime: string; endTime: string }>;
    }>;
    exceptions: Array<{
      date: string;
      isClosed: boolean;
      allDay: boolean;
      intervals: Array<{ startTime: string; endTime: string }>;
    }>;
  } | null;
  units: Array<{
    id: string;
    timezone: string;
    prepMinutes: number;
    cleanupMinutes: number;
    stepMinutes: number;
    minDurationMinutes: number | null;
    rules: Array<{ weekday: number; startMinutes: number; endMinutes: number }>;
    exceptions: Array<{
      date: string;
      kind: "CLOSED" | "OPEN_OVERRIDE";
      startMinutes: number | null;
      endMinutes: number | null;
    }>;
    blocks: Array<{ blockStart: Date; blockEnd: Date }>;
    allocations: Array<{
      blockStart: Date;
      blockEnd: Date;
      status: "HELD" | "CONFIRMED";
      expiresAt: Date | null;
    }>;
  }>;
};

function overlaps(a: UtcInterval, b: UtcInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

function localInterval(dateKey: string, range: LocalInterval, timezone: string): UtcInterval | null {
  const start = localMinuteToUtc(dateKey, range.startMinutes, timezone);
  const end = localMinuteToUtc(dateKey, range.endMinutes, timezone);
  if (!start || !end || end <= start) return null;
  return { start, end };
}

function parseOpeningIntervals(
  entries: Array<{ startTime: string; endTime: string }>,
): LocalInterval[] {
  return entries.flatMap((entry) => {
    const startMinutes = parseClockMinutes(entry.startTime);
    const endMinutes = parseClockMinutes(entry.endTime);
    if (startMinutes == null || endMinutes == null || startMinutes === endMinutes) return [];
    return [{ startMinutes, endMinutes }];
  });
}

function openingWindows(snapshot: SlotSnapshot, dateKey: string): UtcInterval[] {
  const hours = snapshot.openingHours;
  if (!hours || hours.mode === "BY_APPOINTMENT" || hours.mode === "TEMPORARILY_CLOSED") return [];
  const exception = hours.exceptions.find((item) => item.date === dateKey);
  if (exception?.isClosed) return [];
  let intervals: LocalInterval[];
  if (exception) {
    intervals = exception.allDay
      ? [{ startMinutes: 0, endMinutes: 1440 }]
      : parseOpeningIntervals(exception.intervals);
  } else if (hours.mode === "ALWAYS_OPEN") {
    intervals = [{ startMinutes: 0, endMinutes: 1440 }];
  } else {
    const rule = hours.rules.find((item) => item.dayOfWeek === DAY_OF_WEEK[isoWeekday(dateKey) - 1]);
    if (!rule?.isOpen) return [];
    intervals = rule.allDay
      ? [{ startMinutes: 0, endMinutes: 1440 }]
      : parseOpeningIntervals(rule.intervals);
  }
  return intervals.flatMap((interval) => {
    const start = localMinuteToUtc(dateKey, interval.startMinutes, hours.timezone);
    const endDate = interval.endMinutes < interval.startMinutes ? shiftDateKey(dateKey, 1) : dateKey;
    const end = localMinuteToUtc(endDate, interval.endMinutes, hours.timezone);
    return start && end && end > start ? [{ start, end }] : [];
  });
}

function unitWindows(unit: SlotSnapshot["units"][number], dateKey: string): UtcInterval[] {
  const exceptions = unit.exceptions.filter((item) => item.date === dateKey);
  const overrides = exceptions.filter((item) => item.kind === "OPEN_OVERRIDE");
  const localRanges = overrides.length > 0
    ? overrides.map((item) => ({
        startMinutes: item.startMinutes ?? 0,
        endMinutes: item.endMinutes ?? 1440,
      }))
    : unit.rules
        .filter((rule) => rule.weekday === isoWeekday(dateKey))
        .map((rule) => ({ startMinutes: rule.startMinutes, endMinutes: rule.endMinutes }));
  return localRanges.flatMap((range) => {
    const window = localInterval(dateKey, range, unit.timezone);
    return window ? [window] : [];
  });
}

function mergeWindows(windows: UtcInterval[]): UtcInterval[] {
  const sorted = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: UtcInterval[] = [];
  for (const window of sorted) {
    const last = merged[merged.length - 1];
    if (last && window.start <= last.end) {
      last.end = maxDate(last.end, window.end);
    } else {
      merged.push({ ...window });
    }
  }
  return merged;
}

function occupiedSeats(
  snapshot: SlotSnapshot,
  sessionId: string | undefined,
  start: Date,
  end: Date,
  now: Date,
): number {
  return snapshot.requests.reduce((sum, request) => {
    const active = request.status === "CONFIRMED" ||
      (request.status === "NEW" && request.holdUntil != null && request.holdUntil > now);
    if (!active) return sum;
    const sameSession = sessionId && request.offerSessionId === sessionId;
    const sameStart = !request.offerSessionId && request.startsAt?.getTime() === start.getTime();
    const sameLegacyCampShift = Boolean(snapshot.scheduleKind === "SHIFTS" &&
      !request.offerSessionId && !request.startsAt && request.campShiftDateFrom && request.campShiftDateTo &&
      request.campShiftDateFrom.getTime() === start.getTime() &&
      request.campShiftDateTo.getTime() <= end.getTime());
    return sameSession || sameStart || sameLegacyCampShift
      ? sum + (sameLegacyCampShift ? Math.max(1, request.childrenCount ?? 1) : request.seats)
      : sum;
  }, 0);
}

function putGroupSlot(
  slots: Map<string, Slot>,
  snapshot: SlotSnapshot,
  start: Date,
  end: Date,
  capacity: number | null,
  sessionId: string | undefined,
  lower: Date,
  upper: Date,
  requestedSeats: number,
  now: Date,
) {
  if (start < lower || start >= upper || end <= start || capacity == null || capacity <= 0) return;
  const remaining = capacity - occupiedSeats(snapshot, sessionId, start, end, now);
  if (remaining < requestedSeats) return;
  const key = `${start.toISOString()}|${end.toISOString()}`;
  const existing = slots.get(key);
  if (!existing || (existing.remainingSeats ?? Infinity) > remaining) {
    slots.set(key, { startsAt: start, endsAt: end, remainingSeats: remaining, unitIds: [], ...(sessionId ? { sessionId } : {}) });
  }
}

function isUnitFree(
  unit: SlotSnapshot["units"][number],
  service: UtcInterval,
  bufferMin: number,
  now: Date,
): boolean {
  const allocated: UtcInterval = {
    start: new Date(service.start.getTime() - unit.prepMinutes * MINUTE_MS),
    end: new Date(service.end.getTime() + (unit.cleanupMinutes + bufferMin) * MINUTE_MS),
  };
  for (const exception of unit.exceptions) {
    if (exception.kind !== "CLOSED") continue;
    const closed = localInterval(exception.date, {
      startMinutes: exception.startMinutes ?? 0,
      endMinutes: exception.endMinutes ?? 1440,
    }, unit.timezone);
    if (closed && overlaps(service, closed)) return false;
  }
  if (unit.blocks.some((block) => overlaps(allocated, { start: block.blockStart, end: block.blockEnd }))) return false;
  return !unit.allocations.some((allocation) => {
    if (allocation.status === "HELD" && allocation.expiresAt && allocation.expiresAt <= now) return false;
    return overlaps(allocated, { start: allocation.blockStart, end: allocation.blockEnd });
  });
}

/** Pure calculation. reserveSlot must repeat these checks inside its transaction. */
export function calculateSlots(
  snapshot: SlotSnapshot,
  input: Pick<GetSlotsInput, "from" | "to" | "requestedSeats">,
  now = new Date(),
): Slot[] {
  const requestedSeats = input.requestedSeats ?? 1;
  if (!Number.isInteger(requestedSeats) || requestedSeats < 1) throw new RangeError("requestedSeats must be positive");
  if (!(input.from instanceof Date) || !(input.to instanceof Date) ||
      !Number.isFinite(input.from.getTime()) || !Number.isFinite(input.to.getTime()) || input.from >= input.to) {
    throw new RangeError("Invalid slot range");
  }
  if (snapshot.mode !== "USE_PUBLICATION_DATES" && snapshot.mode !== "USE_PUBLICATION_SLOTS") return [];
  if (!snapshot.scheduleKind) return [];
  if (snapshot.horizonDays < 1 || snapshot.horizonDays > 366) throw new RangeError("Invalid horizonDays");
  const lower = maxDate(input.from, new Date(now.getTime() + snapshot.leadTimeHours * 60 * MINUTE_MS));
  const upper = minDate(input.to, new Date(now.getTime() + snapshot.horizonDays * DAY_MS));
  if (lower >= upper) return [];
  const firstDate = shiftDateKey(dateKeyInZone(lower, snapshot.timezone), -1);
  const lastDate = dateKeyInZone(upper, snapshot.timezone);
  const closedDates = new Set(snapshot.closedDates);
  const sessionsByStart = new Map(snapshot.sessions.map((session) => [session.startAt.getTime(), session]));
  const slots = new Map<string, Slot>();

  if (snapshot.scheduleKind === "DATED_SESSIONS" || snapshot.scheduleKind === "SHIFTS") {
    for (const session of snapshot.sessions) {
      if (session.isCancelled || closedDates.has(dateKeyInZone(session.startAt, snapshot.timezone))) continue;
      putGroupSlot(slots, snapshot, session.startAt, session.endAt,
        session.capacity ?? snapshot.capacity, session.id, lower, upper, requestedSeats, now);
    }
  } else if (snapshot.scheduleKind === "RECURRING_SESSIONS") {
    for (let date = firstDate; date <= lastDate; date = shiftDateKey(date, 1)) {
      if (closedDates.has(date)) continue;
      for (const rule of snapshot.rules) {
        if (rule.weekday !== isoWeekday(date) || (rule.validFrom && date < rule.validFrom) ||
            (rule.validTo && date > rule.validTo)) continue;
        const start = localMinuteToUtc(date, rule.startMinutes, snapshot.timezone);
        const end = snapshot.durationMin
          ? start && new Date(start.getTime() + snapshot.durationMin * MINUTE_MS)
          : localMinuteToUtc(date, rule.endMinutes, snapshot.timezone);
        if (!start || !end) continue;
        const existing = sessionsByStart.get(start.getTime());
        if (existing?.isCancelled) continue;
        putGroupSlot(slots, snapshot, start, existing?.endAt ?? end,
          existing?.capacity ?? rule.capacity ?? snapshot.capacity,
          existing?.id, lower, upper, requestedSeats, now);
      }
    }
  } else if (snapshot.scheduleKind === "OPENING_HOURS") {
    const duration = snapshot.durationMin ?? 60;
    if (duration <= 0 || snapshot.capacity == null) return [];
    const seenLocal = new Set<string>();
    const windows: UtcInterval[] = [];
    for (let date = firstDate; date <= lastDate; date = shiftDateKey(date, 1)) {
      windows.push(...openingWindows(snapshot, date));
    }
    for (const window of mergeWindows(windows)) {
      for (let startMs = window.start.getTime(); startMs + duration * MINUTE_MS <= window.end.getTime();
           startMs += SLOT_STEP_MINUTES * MINUTE_MS) {
        const start = new Date(startMs);
        const localKey = localMinuteKey(start, snapshot.timezone);
        const slotDate = localKey.slice(0, 10);
        if (seenLocal.has(localKey) || closedDates.has(slotDate) ||
            snapshot.openingHours?.exceptions.some((exception) => exception.date === slotDate && exception.isClosed)) continue;
        seenLocal.add(localKey);
        const existing = sessionsByStart.get(startMs);
        if (existing?.isCancelled) continue;
        putGroupSlot(slots, snapshot, start, existing?.endAt ?? new Date(startMs + duration * MINUTE_MS),
          existing?.capacity ?? snapshot.capacity, existing?.id, lower, upper, requestedSeats, now);
      }
    }
  } else if (snapshot.scheduleKind === "ON_REQUEST_WINDOWS") {
    const duration = snapshot.durationMin;
    if (!duration || duration <= 0) return [];
    for (const unit of snapshot.units) {
      if (unit.minDurationMinutes != null && duration < unit.minDurationMinutes) continue;
      const seenLocal = new Set<string>();
      const windows: UtcInterval[] = [];
      const unitFirst = shiftDateKey(dateKeyInZone(lower, unit.timezone), -1);
      const unitLast = dateKeyInZone(upper, unit.timezone);
      for (let date = unitFirst; date <= unitLast; date = shiftDateKey(date, 1)) {
        windows.push(...unitWindows(unit, date));
      }
      for (const window of mergeWindows(windows)) {
        for (let startMs = window.start.getTime(); startMs + duration * MINUTE_MS <= window.end.getTime();
             startMs += Math.max(1, unit.stepMinutes) * MINUTE_MS) {
          const start = new Date(startMs);
          const localKey = localMinuteKey(start, unit.timezone);
          if (seenLocal.has(localKey) || closedDates.has(dateKeyInZone(start, snapshot.timezone))) continue;
          seenLocal.add(localKey);
          const service = { start, end: new Date(startMs + duration * MINUTE_MS) };
          if (start < lower || start >= upper || !isUnitFree(unit, service, snapshot.bufferMin, now)) continue;
          const key = `${service.start.toISOString()}|${service.end.toISOString()}`;
          const existing = slots.get(key);
          if (existing) existing.unitIds.push(unit.id);
          else slots.set(key, { startsAt: service.start, endsAt: service.end, remainingSeats: null, unitIds: [unit.id] });
        }
      }
    }
  }

  return [...slots.values()]
    .map((slot) => ({ ...slot, unitIds: slot.unitIds.sort() }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.endsAt.getTime() - b.endsAt.getTime());
}
