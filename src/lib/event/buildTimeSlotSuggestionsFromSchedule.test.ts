import assert from "node:assert/strict";

import { buildTimeSlotSuggestionsFromSchedule } from "./buildTimeSlotSuggestionsFromSchedule";

const today = "2026-11-13";

// Single date: date + start/end time come straight from the schedule item.
assert.deepEqual(
  buildTimeSlotSuggestionsFromSchedule(
    [{ date: "2026-11-20", allDay: false, startTime: "10:00", endTime: "12:30" }],
    { today },
  ),
  {
    suggestions: [{ date: "2026-11-20", startTime: "10:00", endTime: "12:30" }],
    truncated: false,
  },
);

// Multi-day range expands inclusively; two sessions on one date stay separate; sorted.
assert.deepEqual(
  buildTimeSlotSuggestionsFromSchedule(
    [
      { date: "2026-11-21", dateEnd: "2026-11-22", startTime: "15:00", endTime: "16:00" },
      { date: "2026-11-21", startTime: "11:00", endTime: "12:00" },
    ],
    { today },
  ).suggestions,
  [
    { date: "2026-11-21", startTime: "11:00", endTime: "12:00" },
    { date: "2026-11-21", startTime: "15:00", endTime: "16:00" },
    { date: "2026-11-22", startTime: "15:00", endTime: "16:00" },
  ],
);

// Weekly recurrence follows the canonical session materializer.
assert.deepEqual(
  buildTimeSlotSuggestionsFromSchedule(
    [
      {
        date: "2026-11-14",
        startTime: "10:00",
        endTime: "11:00",
        recurringEnabled: true,
        recurrenceInterval: 1,
        recurrenceUnit: "week",
        recurrenceUntil: "2026-11-28",
      },
    ],
    { today },
  ).suggestions.map((slot) => slot.date),
  ["2026-11-14", "2026-11-21", "2026-11-28"],
);

// Past dates are skipped; today is kept.
assert.deepEqual(
  buildTimeSlotSuggestionsFromSchedule(
    [
      { date: "2026-11-12", startTime: "10:00", endTime: "11:00" },
      { date: "2026-11-13", startTime: "10:00", endTime: "11:00" },
    ],
    { today },
  ).suggestions.map((slot) => slot.date),
  ["2026-11-13"],
);

// All-day item: only the date is suggested, no invented time.
assert.deepEqual(
  buildTimeSlotSuggestionsFromSchedule(
    [{ date: "2026-11-20", allDay: true, startTime: "10:00", endTime: "18:00" }],
    { today },
  ).suggestions,
  [{ date: "2026-11-20", startTime: "", endTime: "" }],
);

// End not later than start (overnight) or missing: end is left for the business.
assert.deepEqual(
  buildTimeSlotSuggestionsFromSchedule(
    [
      { date: "2026-11-20", startTime: "22:00", endTime: "01:00" },
      { date: "2026-11-21", startTime: "10:00", endTime: "" },
    ],
    { today },
  ).suggestions,
  [
    { date: "2026-11-20", startTime: "22:00", endTime: "" },
    { date: "2026-11-21", startTime: "10:00", endTime: "" },
  ],
);

// Undated default item and empty input produce nothing.
assert.deepEqual(
  buildTimeSlotSuggestionsFromSchedule([{ date: null, startTime: "10:00", endTime: "18:00" }], { today }),
  { suggestions: [], truncated: false },
);
assert.deepEqual(buildTimeSlotSuggestionsFromSchedule(undefined, { today }).suggestions, []);

// Long recurrence is capped and flagged.
{
  const result = buildTimeSlotSuggestionsFromSchedule(
    [
      {
        date: "2026-11-14",
        startTime: "10:00",
        endTime: "11:00",
        recurringEnabled: true,
        recurrenceInterval: 1,
        recurrenceUnit: "day",
        recurrenceUntil: "2027-06-01",
      },
    ],
    { today, limit: 5 },
  );
  assert.equal(result.suggestions.length, 5);
  assert.equal(result.truncated, true);
  assert.equal(result.suggestions[0]?.date, "2026-11-14");
}

console.log("buildTimeSlotSuggestionsFromSchedule: OK");
