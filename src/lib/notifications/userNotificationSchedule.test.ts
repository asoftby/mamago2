import assert from "node:assert/strict";
import {
  ADMIN_PLAN_REMINDER_OFFSETS,
  computeNextPlanEveningRunAt,
  DEFAULT_PLAN_EVENING_TIME,
  DEFAULT_PLAN_REMINDER_OFFSET_MINUTES,
  getTimeZoneDateKey,
  isPlanReminderOffsetAllowed,
  isValidTimeZone,
  normalizePlanReminderOffset,
  USER_PLAN_REMINDER_OFFSETS,
  zonedLocalDateTimeToUtc,
} from "./userNotificationSchedule";

assert.equal(DEFAULT_PLAN_EVENING_TIME, "19:00");
assert.equal(DEFAULT_PLAN_REMINDER_OFFSET_MINUTES, 120);
assert.deepEqual(USER_PLAN_REMINDER_OFFSETS, [30, 60, 120, 180]);
assert.deepEqual(ADMIN_PLAN_REMINDER_OFFSETS, [5, 30, 60, 120, 180]);
assert.equal(normalizePlanReminderOffset(5, false), 120);
assert.equal(normalizePlanReminderOffset(5, true), 5);

assert.equal(isValidTimeZone("Europe/Minsk"), true);
assert.equal(isValidTimeZone("Not/A_Zone"), false);
assert.equal(isPlanReminderOffsetAllowed(5, false), false);
assert.equal(isPlanReminderOffsetAllowed(5, true), true);
assert.equal(isPlanReminderOffsetAllowed(120, false), true);

{
  const utc = zonedLocalDateTimeToUtc("2026-08-27", "19:00", "Europe/Minsk");
  assert.equal(utc.toISOString(), "2026-08-27T16:00:00.000Z");
  assert.equal(getTimeZoneDateKey(utc, "Europe/Minsk"), "2026-08-27");
}

{
  const before = new Date("2026-08-27T15:00:00.000Z");
  const next = computeNextPlanEveningRunAt({
    now: before,
    timeZone: "Europe/Minsk",
    localTime: "19:00",
  });
  assert.equal(next.toISOString(), "2026-08-27T16:00:00.000Z");
}

{
  const after = new Date("2026-08-27T17:00:00.000Z");
  const next = computeNextPlanEveningRunAt({
    now: after,
    timeZone: "Europe/Minsk",
    localTime: "19:00",
  });
  assert.equal(next.toISOString(), "2026-08-28T16:00:00.000Z");
}

assert.equal(
  zonedLocalDateTimeToUtc("2026-03-28", "19:00", "Europe/Amsterdam").toISOString(),
  "2026-03-28T18:00:00.000Z",
);
assert.equal(
  zonedLocalDateTimeToUtc("2026-03-30", "19:00", "Europe/Amsterdam").toISOString(),
  "2026-03-30T17:00:00.000Z",
);

console.log("user-notification-schedule tests: OK");
