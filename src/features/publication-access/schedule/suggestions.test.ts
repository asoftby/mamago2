import assert from "node:assert/strict";

import {
  createEmptyScheduleDay,
  createEmptyScheduleSlot,
  flatSlotsToGroupedDays,
  scheduleDaysToPersistedSlots,
} from "./mappers";
import {
  findMissingTimeSlotSuggestions,
  mergeTimeSlotSuggestionsIntoDays,
  type TimeSlotSuggestion,
} from "./suggestions";
import type { ScheduleDay } from "./types";

const suggestions: TimeSlotSuggestion[] = [
  { date: "2026-11-20", startTime: "10:00", endTime: "12:00" },
  { date: "2026-11-20", startTime: "15:00", endTime: "17:00" },
  { date: "2026-11-21", startTime: "10:00", endTime: "12:00" },
];

// 1. Default fill: an empty editor (one pristine placeholder block) is seeded from the schedule.
const pristine: ScheduleDay[] = [{ ...createEmptyScheduleDay(), slots: [createEmptyScheduleSlot()] }];
const seeded = mergeTimeSlotSuggestionsIntoDays(pristine, suggestions);
assert.deepEqual(
  seeded.map((day) => ({
    date: day.date,
    slots: day.slots.map(({ startTime, endTime, capacity }) => ({ startTime, endTime, capacity })),
  })),
  [
    {
      date: "2026-11-20",
      slots: [
        { startTime: "10:00", endTime: "12:00", capacity: null },
        { startTime: "15:00", endTime: "17:00", capacity: null },
      ],
    },
    { date: "2026-11-21", slots: [{ startTime: "10:00", endTime: "12:00", capacity: null }] },
  ],
);
assert.deepEqual(findMissingTimeSlotSuggestions(seeded, suggestions), []);
// Seeded rows have no capacity yet, so nothing is persisted until the business fills it in.
assert.deepEqual(scheduleDaysToPersistedSlots(seeded), []);

// 2. Manual change: the business edits a seeded slot and sets capacity.
const edited = seeded.map((day) =>
  day.date === "2026-11-20"
    ? {
        ...day,
        slots: day.slots.map((slot) =>
          slot.startTime === "10:00" ? { ...slot, startTime: "10:30", endTime: "12:30", capacity: 8 } : slot,
        ),
      }
    : day,
);
// 3. Manual add: an extra slot on a date that is not in the schedule at all.
const manualSlot = { ...createEmptyScheduleSlot(), startTime: "09:00", endTime: "10:00", capacity: 5 };
const withManual: ScheduleDay[] = [
  ...edited,
  { id: "day-2026-12-01", date: "2026-12-01", slots: [manualSlot] },
];

// 4. Save: only complete rows are persisted, with the manual values.
assert.deepEqual(
  scheduleDaysToPersistedSlots(withManual).map(({ date, startTime, endTime, capacity }) => ({
    date,
    startTime,
    endTime,
    capacity,
  })),
  [
    { date: "2026-11-20", startTime: "10:30", endTime: "12:30", capacity: 8 },
    { date: "2026-12-01", startTime: "09:00", endTime: "10:00", capacity: 5 },
  ],
);

// 5. Schedule changed later: the edited 10:00 → 10:30 slot is reported as missing, never rewritten.
const laterSuggestions: TimeSlotSuggestion[] = [
  ...suggestions,
  { date: "2026-11-22", startTime: "10:00", endTime: "12:00" },
];
assert.deepEqual(findMissingTimeSlotSuggestions(withManual, laterSuggestions), [
  { date: "2026-11-20", startTime: "10:00", endTime: "12:00" },
  { date: "2026-11-22", startTime: "10:00", endTime: "12:00" },
]);
const merged = mergeTimeSlotSuggestionsIntoDays(withManual, laterSuggestions);
for (const day of withManual) {
  const after = merged.find((item) => item.date === day.date);
  assert.ok(after, `day ${day.date} must survive the merge`);
  for (const slot of day.slots) {
    assert.deepEqual(
      after.slots.find((item) => item.id === slot.id),
      slot,
      "existing slots keep id, times and capacity",
    );
  }
}
assert.deepEqual(merged.map((day) => day.date), ["2026-11-20", "2026-11-21", "2026-11-22", "2026-12-01"]);
assert.deepEqual(findMissingTimeSlotSuggestions(merged, laterSuggestions), []);
// Merging again adds nothing (idempotent).
assert.equal(
  mergeTimeSlotSuggestionsIntoDays(merged, laterSuggestions).flatMap((day) => day.slots).length,
  merged.flatMap((day) => day.slots).length,
);
// The input is not mutated.
assert.equal(withManual.length, 3);
assert.equal(withManual[0]?.slots.length, 2);

// 6. Saved slots reloaded from the API are not re-seeded or altered.
const saved = flatSlotsToGroupedDays([
  { id: "s1", date: "2026-11-20", startTime: "10:00", endTime: "12:00", capacity: 4 },
]);
assert.deepEqual(
  mergeTimeSlotSuggestionsIntoDays(saved, [suggestions[0]!]).flatMap((day) => day.slots),
  saved.flatMap((day) => day.slots),
);

// 7. Date-only suggestion (all-day schedule): adds the date once; any block for that date covers it.
const dateOnly: TimeSlotSuggestion[] = [{ date: "2026-11-25", startTime: "", endTime: "" }];
const dateOnlyDays = mergeTimeSlotSuggestionsIntoDays([], dateOnly);
assert.equal(dateOnlyDays.length, 1);
assert.equal(dateOnlyDays[0]?.date, "2026-11-25");
assert.deepEqual(findMissingTimeSlotSuggestions(dateOnlyDays, dateOnly), []);

// 8. A picked date with a still-empty first slot is filled instead of growing a second row.
const pickedDate: ScheduleDay[] = [
  { id: "day-x", date: "2026-11-21", slots: [createEmptyScheduleSlot()] },
];
const filled = mergeTimeSlotSuggestionsIntoDays(pickedDate, [suggestions[2]!]);
assert.equal(filled[0]?.slots.length, 1);
assert.equal(filled[0]?.slots[0]?.startTime, "10:00");

console.log("publication-access schedule suggestions: OK");
