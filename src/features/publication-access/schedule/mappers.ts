import type { PublicationAccessTimeSlot } from "../types";
import type { ScheduleDay, ScheduleSlot } from "./types";

function newSlotId(): string {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newDayId(): string {
  return `day-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Плоский список из API / PublicationAccess → дни со слотами.
 */
export function flatSlotsToGroupedDays(slots: PublicationAccessTimeSlot[]): ScheduleDay[] {
  const byDate = new Map<
    string,
    { dayId: string; slots: ScheduleSlot[] }
  >();

  for (const flat of slots) {
    const dateKey = flat.date?.trim() ?? "";
    const slot: ScheduleSlot = {
      id: flat.id || newSlotId(),
      startTime: flat.startTime ?? "",
      endTime: flat.endTime ?? flat.startTime ?? "",
      capacity: flat.capacity ?? 1,
    };

    const existing = byDate.get(dateKey);
    if (existing) {
      existing.slots.push(slot);
      continue;
    }

    byDate.set(dateKey, {
      dayId: dateKey ? `day-${dateKey}` : "day-no-date",
      slots: [slot],
    });
  }

  const days: ScheduleDay[] = Array.from(byDate.entries()).map(([iso, bundle]) => ({
    id: bundle.dayId,
    date: iso,
    slots: bundle.slots,
  }));

  days.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  return days;
}

/**
 * Сгруппированное состояние редактора → плоский payload для API.
 */
export function groupedDaysToFlatSlots(days: ScheduleDay[]): PublicationAccessTimeSlot[] {
  const out: PublicationAccessTimeSlot[] = [];
  for (const day of days) {
    const iso = day.date?.trim() ?? "";
    for (const slot of day.slots) {
      out.push({
        id: slot.id,
        date: iso,
        startTime: slot.startTime,
        endTime: slot.endTime || undefined,
        capacity: slot.capacity,
      });
    }
  }
  return out;
}

/** Пустой день (новая дата). */
export function createEmptyScheduleDay(): ScheduleDay {
  return {
    id: newDayId(),
    date: "",
    slots: [],
  };
}

export function createEmptyScheduleSlot(): ScheduleSlot {
  return {
    id: newSlotId(),
    startTime: "",
    endTime: "",
    capacity: 6,
  };
}
