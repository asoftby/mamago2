/** PostgreSQL overlap semantics: start < requested end AND end > requested start. */
export function overlapsBookingWindow(
  block: { blockStart: Date; blockEnd: Date },
  window: { blockStart: Date; blockEnd: Date },
): boolean {
  return block.blockStart < window.blockEnd && block.blockEnd > window.blockStart;
}

import type { AvailabilityEvidence, ServiceInterval } from "@/lib/birthday/constructorContract";
import { minskBookingWindow, isWithinSchedule, isPartyStartOnStep } from "./partyConfirmationAvailability";
import { previewPartySlots, type PreviewUnit } from "./partyPublicSlots";

export type ConstructorUnit = PreviewUnit & { id: string; updatedAt: Date };

/** Same resource/calendar primitives as public slots. Read evidence, never a reservation. */
export function assessPartyAvailability(units: readonly ConstructorUnit[], requested: ServiceInterval | null, guestCount: number, now: Date): AvailabilityEvidence {
  if (!requested) return { state: "UNKNOWN", reason: "NO_EXACT_TIME" };
  if (!units.length) return { state: "UNKNOWN", reason: "NO_RESOURCE" };
  const start = new Date(requested.startAt), end = new Date(requested.endAt);
  const parts = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Minsk", dateStyle: "short", timeStyle: "short" }).format(date).split(" ");
  const [day, from] = parts(start), [endDay, to] = parts(end);
  const durationMinutes = (end.getTime() - start.getTime()) / 60_000;
  if (day !== endDay || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return { state: "UNKNOWN", reason: "CHECK_FAILED" };
  const date = new Date(day + "T00:00:00.000Z");
  const windows: Extract<AvailabilityEvidence, {state: "AVAILABLE"}>["windows"] = [];
  let unknown = false, reason: "OCCUPIED" | "CLOSED" | "CAPACITY" | "DURATION" = "CLOSED";
  const alternatives = new Map<string, ServiceInterval>();
  for (const unit of units) {
    if (unit.status !== "ACTIVE") continue;
    if (unit.timezone !== "Europe/Minsk" || !Number.isInteger(unit.stepMinutes) || unit.stepMinutes < 5 || unit.stepMinutes > 240 || unit.prepMinutes < 0 || unit.cleanupMinutes < 0) { unknown = true; continue; }
    if (!unit.rules.length && !unit.exceptions.length) { unknown = true; continue; }
    if (unit.capacity !== null && guestCount > unit.capacity) { reason = "CAPACITY"; continue; }
    if (unit.minDurationMinutes !== null && durationMinutes < unit.minDurationMinutes) { reason = "DURATION"; continue; }
    const w = minskBookingWindow(date, from, to, unit.prepMinutes, unit.cleanupMinutes);
    const minutePrecision = start.getUTCSeconds() === 0 && end.getUTCSeconds() === 0 && start.getUTCMilliseconds() === 0 && end.getUTCMilliseconds() === 0;
    const onStep = minutePrecision && isPartyStartOnStep(w, unit.rules, unit.exceptions, unit.stepMinutes);
    const occupied = [...unit.blocks, ...unit.allocations].some(b => overlapsBookingWindow(b, w));
    if (occupied) reason = "OCCUPIED";
    if (start > now && onStep && !occupied && isWithinSchedule(w, unit.rules, unit.exceptions)) windows.push({
      bookingUnitId: unit.id, service: requested,
      occupied: { startAt: w.blockStart.toISOString(), endAt: w.blockEnd.toISOString() },
      prepMinutes: unit.prepMinutes, cleanupMinutes: unit.cleanupMinutes,
    });
    for (const slot of previewPartySlots({ day, durationMinutes, guestCount, now, units: [unit] })) {
      const candidate = minskBookingWindow(date, slot.start, slot.end, 0, 0);
      const interval = { startAt: candidate.serviceStart.toISOString(), endAt: candidate.serviceEnd.toISOString() };
      alternatives.set(interval.startAt, interval);
    }
  }
  const checkedAt = now.toISOString();
  if (windows.length) return { state: "AVAILABLE", requested, checkedAt, windows };
  if (alternatives.size) return { state: "PARTIAL", requested, checkedAt, alternatives: [...alternatives.values()].sort((a,b) => a.startAt.localeCompare(b.startAt)).slice(0,80) };
  if (unknown) return { state: "UNKNOWN", reason: "NO_SCHEDULE" };
  return { state: "UNAVAILABLE", requested, checkedAt, reason };
}
