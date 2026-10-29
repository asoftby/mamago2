import { isWithinSchedule, minskBookingWindow } from "./partyConfirmationAvailability";

export type PreviewUnit = {
  status: "ACTIVE" | "INACTIVE";
  timezone: string;
  capacity: number | null;
  prepMinutes: number;
  cleanupMinutes: number;
  minDurationMinutes: number | null;
  stepMinutes: number;
  rules: Array<{ weekday: number; startMinutes: number; endMinutes: number }>;
  exceptions: Array<{
    kind: "CLOSED" | "OPEN_OVERRIDE"; startMinutes: number | null; endMinutes: number | null;
  }>;
  blocks: Array<{ blockStart: Date; blockEnd: Date }>;
  allocations: Array<{ blockStart: Date; blockEnd: Date }>;
};

export type PublicPartySlot = { start: string; end: string };

function timeAt(minutes: number): string {
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" +
    String(minutes % 60).padStart(2, "0");
}

function overlaps(
  blockStart: Date, blockEnd: Date, start: Date, end: Date,
): boolean {
  return blockStart < end && blockEnd > start;
}

/**
 * A non-binding preview of free wall-clock intervals in Europe/Minsk.
 * The final confirmation MUST still lock BookingUnit and recheck availability.
 * Never expose resource identifiers, allocation details, or exact capacity.
 */
export function previewPartySlots(params: {
  day: string;
  durationMinutes: number;
  guestCount: number;
  now: Date;
  units: PreviewUnit[];
}): PublicPartySlot[] {
  const { day, durationMinutes, guestCount, now, units } = params;
  const dayDate = new Date(day + "T00:00:00.000Z");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 720 ||
      !Number.isInteger(guestCount) || guestCount < 1 || guestCount > 1000 ||
      !Number.isFinite(dayDate.getTime()) || dayDate.toISOString().slice(0, 10) !== day) return [];

  const available = new Map<string, PublicPartySlot>();
  for (const unit of units) {
    if (unit.status !== "ACTIVE" || unit.timezone !== "Europe/Minsk" ||
        (unit.capacity !== null && guestCount > unit.capacity) ||
        (unit.minDurationMinutes !== null && durationMinutes < unit.minDurationMinutes)) continue;

    const step = unit.stepMinutes;
    if (!Number.isInteger(step) || step < 5 || step > 240) continue;
    // Each resource's step is relative to the opening of each weekly/override interval,
    // not necessarily midnight (e.g. 10:30 opening with 60-minute steps).
    const weekday = dayDate.getUTCDay() || 7;
    const anchors = [
      ...unit.rules.filter(rule => rule.weekday === weekday).map(rule => rule.startMinutes),
      ...unit.exceptions.filter(item => item.kind === "OPEN_OVERRIDE").map(item => item.startMinutes ?? 0),
    ];
    // End at or before 23:59: 24:00 is not accepted by the final booking window.
    for (const anchor of new Set(anchors)) for (let start = anchor; start + durationMinutes < 1440; start += step) {
      const end = start + durationMinutes;
      const startTime = timeAt(start);
      const endTime = timeAt(end);
      const window = minskBookingWindow(dayDate, startTime, endTime,
        unit.prepMinutes, unit.cleanupMinutes);
      if (window.serviceStart <= now ||
          !isWithinSchedule(window, unit.rules, unit.exceptions)) continue;
      if (unit.blocks.some(block => overlaps(block.blockStart, block.blockEnd, window.blockStart, window.blockEnd)) ||
          unit.allocations.some(item => overlaps(item.blockStart, item.blockEnd, window.blockStart, window.blockEnd))) continue;
      available.set(startTime, { start: startTime, end: endTime });
    }
  }
  return Array.from(available.values()).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 80);
}
