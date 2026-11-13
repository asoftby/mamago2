import { createEmptyScheduleDay, createEmptyScheduleSlot } from "./mappers";
import type { ScheduleDay } from "./types";

/**
 * Default slot offered by the owning entity (e.g. an event's schedule).
 * Suggestions only ever seed or extend the editor; they never overwrite a slot.
 */
export type TimeSlotSuggestion = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm or "" when only the date is known. */
  startTime: string;
  /** HH:mm or "" when unknown. */
  endTime: string;
};

function isPristineDay(day: ScheduleDay): boolean {
  return (
    !day.date &&
    day.slots.every((slot) => !slot.startTime && !slot.endTime && slot.capacity == null)
  );
}

function isCovered(days: ScheduleDay[], suggestion: TimeSlotSuggestion): boolean {
  const sameDate = days.filter((day) => day.date === suggestion.date);
  if (sameDate.length === 0) return false;
  // A date-only suggestion is satisfied by any block for that date.
  if (!suggestion.startTime) return true;
  return sameDate.some((day) =>
    day.slots.some((slot) => slot.startTime === suggestion.startTime),
  );
}

/** Suggestions with no matching date+start time in the editor yet. */
export function findMissingTimeSlotSuggestions(
  days: ScheduleDay[],
  suggestions: readonly TimeSlotSuggestion[],
): TimeSlotSuggestion[] {
  return suggestions.filter((suggestion) => !isCovered(days, suggestion));
}

/**
 * Adds missing suggestions as new rows. Existing days/slots are returned
 * untouched (same values, same ids); only untouched empty placeholders are
 * dropped or filled. Capacity is left empty for the business to enter.
 */
export function mergeTimeSlotSuggestionsIntoDays(
  days: ScheduleDay[],
  suggestions: readonly TimeSlotSuggestion[],
): ScheduleDay[] {
  const next = days
    .filter((day) => !isPristineDay(day))
    .map((day) => ({ ...day, slots: [...day.slots] }));
  // A block keeps its id when its date is edited, so a date-derived id for a
  // new block could collide with an existing one (shared React key / patch target).
  const usedIds = new Set(next.map((day) => day.id));
  const newUniqueDayId = (): string => {
    let id = createEmptyScheduleDay().id;
    while (usedIds.has(id)) id = createEmptyScheduleDay().id;
    usedIds.add(id);
    return id;
  };

  for (const suggestion of suggestions) {
    if (!suggestion.date || isCovered(next, suggestion)) continue;

    const slot = {
      ...createEmptyScheduleSlot(),
      startTime: suggestion.startTime,
      endTime: suggestion.endTime,
    };
    const day = next.find((item) => item.date === suggestion.date);
    if (!day) {
      next.push({ id: newUniqueDayId(), date: suggestion.date, slots: [slot] });
      continue;
    }
    const emptyIndex = day.slots.findIndex(
      (item) => !item.startTime && !item.endTime && item.capacity == null,
    );
    if (emptyIndex >= 0) day.slots[emptyIndex] = slot;
    else day.slots.push(slot);
  }

  return next.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}
