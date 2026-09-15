import assert from "node:assert/strict";

import {
  deriveSchedulingKindFromScheduleItems,
  deriveSchedulingKindFromScheduleJson,
} from "./deriveSchedulingKind";

assert.equal(
  deriveSchedulingKindFromScheduleItems([
    { isMultiDay: false, date: "2026-09-20", dateEnd: null, allDay: false },
  ]),
  "SLOT",
);

assert.equal(
  deriveSchedulingKindFromScheduleItems([
    { isMultiDay: true, date: "2026-09-20", dateEnd: "2026-09-25", allDay: false },
  ]),
  "WINDOW",
);

// Switching the multi-day toggle on is not enough: until the editor chooses
// a real end date the occurrence remains a timed single-day slot.
assert.equal(
  deriveSchedulingKindFromScheduleItems([
    { isMultiDay: true, date: "2026-09-20", dateEnd: null, allDay: false },
  ]),
  "SLOT",
);

assert.equal(
  deriveSchedulingKindFromScheduleItems([
    { isMultiDay: false, date: "2026-09-20", dateEnd: null, allDay: true },
  ]),
  "WINDOW",
);

assert.equal(
  deriveSchedulingKindFromScheduleItems([
    { isMultiDay: false, date: "2026-09-20", dateEnd: "2026-09-21", allDay: false },
  ]),
  "WINDOW",
);

assert.equal(deriveSchedulingKindFromScheduleItems([]), "SLOT");

// Imported/legacy read-side classification: explicit times are slots.
assert.equal(
  deriveSchedulingKindFromScheduleJson({
    mode: "ONE_TIME",
    dates: ["2026-09-20"],
    startTime: "12:00",
  }),
  "SLOT",
);

// A source date with no clock time is a flexible visit window, not UNKNOWN.
assert.equal(
  deriveSchedulingKindFromScheduleJson({
    mode: "ONE_TIME",
    dates: ["2026-09-20"],
  }),
  "WINDOW",
);

// Imported date ranges are windows even when a daily start time is present.
assert.equal(
  deriveSchedulingKindFromScheduleJson({
    mode: "ONE_TIME",
    dates: ["2026-09-20"],
    scheduleItems: [
      { date: "2026-09-20", dateEnd: "2026-09-25", startTime: "12:00" },
    ],
  }),
  "WINDOW",
);

assert.equal(deriveSchedulingKindFromScheduleJson({}), null);
assert.equal(deriveSchedulingKindFromScheduleJson(null), null);

console.log("deriveSchedulingKind tests: OK");
