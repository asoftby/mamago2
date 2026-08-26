import assert from "node:assert/strict";

import { resolveScheduleItemTimeOrder } from "./scheduleItemTimeOrder";

// 1. 12:00 → 18:00 — same day
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    allDay: false,
    startTime: "12:00",
    endTime: "18:00",
  });
  assert.equal(r.isValid, true);
  assert.equal(r.crossesMidnight, false);
}

// 2. 20:00 → 02:00 — ends next day
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    allDay: false,
    startTime: "20:00",
    endTime: "02:00",
  });
  assert.equal(r.isValid, true);
  assert.equal(r.crossesMidnight, true);
  assert.equal(r.endDateLabel, "2026-08-23");
}

// 3. 23:30 → 00:30 — ends next day
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    allDay: false,
    startTime: "23:30",
    endTime: "00:30",
  });
  assert.equal(r.isValid, true);
  assert.equal(r.crossesMidnight, true);
  assert.equal(r.endDateLabel, "2026-08-23");
}

// 4. 00:30 → 02:00 — same day
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    allDay: false,
    startTime: "00:30",
    endTime: "02:00",
  });
  assert.equal(r.isValid, true);
  assert.equal(r.crossesMidnight, false);
}

// 5. 12:00 → 12:00 — validation error (not treated as 24h)
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    allDay: false,
    startTime: "12:00",
    endTime: "12:00",
  });
  assert.equal(r.isValid, false);
  assert.equal(r.crossesMidnight, false);
}

// 6. allDay — always valid regardless of times
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    allDay: true,
    startTime: "20:00",
    endTime: "02:00",
  });
  assert.equal(r.isValid, true);
  assert.equal(r.crossesMidnight, false);
}

// 7a. Explicit multi-day range, endTime < startTime but end date is genuinely
// after start date — valid, and NOT reported as a midnight rollover (the
// extra day was already explicit, not auto-added).
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    dateEnd: "2026-08-24",
    isMultiDay: true,
    allDay: false,
    startTime: "20:00",
    endTime: "02:00",
  });
  assert.equal(r.isValid, true);
  assert.equal(r.crossesMidnight, false);
}

// 7b. Explicit multi-day range collapsed to a single calendar day
// (dateEnd === date) falls back to the single-day rollover rule.
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    dateEnd: "2026-08-22",
    isMultiDay: true,
    allDay: false,
    startTime: "20:00",
    endTime: "02:00",
  });
  assert.equal(r.isValid, true);
  assert.equal(r.crossesMidnight, true);
  assert.equal(r.endDateLabel, "2026-08-23");
}

// 7c. Explicit multi-day range where the end datetime is still after the
// start datetime even though endTime < startTime — valid, no rollover flag
// (the extra day is explicit, not inferred).
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    dateEnd: "2026-08-23",
    isMultiDay: true,
    allDay: false,
    startTime: "20:00",
    endTime: "10:00",
  });
  assert.equal(r.isValid, true); // 22 Aug 20:00 -> 23 Aug 10:00 is a valid order
  assert.equal(r.crossesMidnight, false);
}

// 7d. Explicit multi-day range where the end datetime is not actually after
// the start datetime — invalid, no auto-rollover applied.
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-23",
    dateEnd: "2026-08-22",
    isMultiDay: true,
    allDay: false,
    startTime: "10:00",
    endTime: "09:00",
  });
  assert.equal(r.isValid, false);
  assert.equal(r.crossesMidnight, false);
}

// Missing times — no order to validate, treated as valid (presence is
// enforced separately).
{
  const r = resolveScheduleItemTimeOrder({
    date: "2026-08-22",
    allDay: false,
    startTime: "",
    endTime: "",
  });
  assert.equal(r.isValid, true);
}

console.log("scheduleItemTimeOrder tests: OK");
