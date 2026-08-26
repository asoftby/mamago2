import assert from "node:assert/strict";

import { collectEventScheduleTimeOrderErrors } from "./validateEventScheduleTimeOrder";

function item(overrides: Record<string, unknown>) {
  return {
    id: "s1",
    isMultiDay: false,
    date: "2026-08-22",
    dateEnd: null,
    allDay: false,
    startTime: "10:00",
    endTime: "18:00",
    ...overrides,
  };
}

// 1. 12:00 -> 18:00: no errors
{
  const errors = collectEventScheduleTimeOrderErrors({
    scheduleItems: [item({ startTime: "12:00", endTime: "18:00" })],
  });
  assert.deepEqual(errors, []);
}

// 2. 20:00 -> 02:00: crosses midnight, accepted
{
  const errors = collectEventScheduleTimeOrderErrors({
    scheduleItems: [item({ startTime: "20:00", endTime: "02:00" })],
  });
  assert.deepEqual(errors, []);
}

// 3. 23:30 -> 00:30: crosses midnight, accepted
{
  const errors = collectEventScheduleTimeOrderErrors({
    scheduleItems: [item({ startTime: "23:30", endTime: "00:30" })],
  });
  assert.deepEqual(errors, []);
}

// 4. 00:30 -> 02:00: same day, accepted
{
  const errors = collectEventScheduleTimeOrderErrors({
    scheduleItems: [item({ startTime: "00:30", endTime: "02:00" })],
  });
  assert.deepEqual(errors, []);
}

// 5. 12:00 -> 12:00: rejected
{
  const errors = collectEventScheduleTimeOrderErrors({
    scheduleItems: [item({ startTime: "12:00", endTime: "12:00" })],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Время окончания должно отличаться от времени начала/);
}

// 6. allDay: time-order check skipped even for a nonsensical time pair
{
  const errors = collectEventScheduleTimeOrderErrors({
    scheduleItems: [item({ allDay: true, startTime: "12:00", endTime: "12:00" })],
  });
  assert.deepEqual(errors, []);
}

// 7. Explicit multi-day range: real start/end datetimes compared directly,
// endTime < startTime is not treated as an automatic extra day.
{
  const errors = collectEventScheduleTimeOrderErrors({
    scheduleItems: [
      item({
        isMultiDay: true,
        date: "2026-08-22",
        dateEnd: "2026-08-24",
        startTime: "20:00",
        endTime: "02:00",
      }),
    ],
  });
  assert.deepEqual(errors, []);
}

// 8. Explicit multi-day range where the end datetime is not actually after
// the start datetime — rejected.
{
  const errors = collectEventScheduleTimeOrderErrors({
    scheduleItems: [
      item({
        isMultiDay: true,
        date: "2026-08-23",
        dateEnd: "2026-08-22",
        startTime: "10:00",
        endTime: "09:00",
      }),
    ],
  });
  assert.equal(errors.length, 1);
}

// 9. Every scheduleItems[] entry is checked, not just the first.
{
  const errors = collectEventScheduleTimeOrderErrors({
    scheduleItems: [
      item({ id: "a", date: "2026-08-22", startTime: "20:00", endTime: "02:00" }),
      item({ id: "b", date: "2026-08-23", startTime: "12:00", endTime: "12:00" }),
      item({ id: "c", date: "2026-08-24", startTime: "09:00", endTime: "09:00" }),
    ],
  });
  assert.equal(errors.length, 2);
  assert.ok(errors.some((e) => e.includes("2026-08-23")));
  assert.ok(errors.some((e) => e.includes("2026-08-24")));
}

// 10. Missing/malformed scheduleJson shapes never throw and produce no errors.
{
  assert.deepEqual(collectEventScheduleTimeOrderErrors(null), []);
  assert.deepEqual(collectEventScheduleTimeOrderErrors(undefined), []);
  assert.deepEqual(collectEventScheduleTimeOrderErrors({}), []);
  assert.deepEqual(collectEventScheduleTimeOrderErrors({ scheduleItems: "not-an-array" }), []);
  assert.deepEqual(collectEventScheduleTimeOrderErrors({ scheduleItems: [null, 42, "x"] }), []);
}

console.log("validateEventScheduleTimeOrder tests: OK");
