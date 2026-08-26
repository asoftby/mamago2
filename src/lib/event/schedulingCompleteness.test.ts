import assert from "node:assert/strict";
import { isSlotScheduleDataComplete, validateSchedulingCompleteness } from "./schedulingCompleteness";

assert.equal(isSlotScheduleDataComplete({ scheduleItems: [{ startTime: "08:00", endTime: "10:00" }] }), true);
assert.equal(isSlotScheduleDataComplete({ durationMinutes: 90, scheduleItems: [{ startTime: "08:00" }] }), true);
assert.equal(isSlotScheduleDataComplete({ scheduleItems: [{ startTime: "08:00" }] }), false);
assert.equal(isSlotScheduleDataComplete({ scheduleItems: [{ startTime: "08:00", endTime: "08:00" }] }), false);
assert.equal(isSlotScheduleDataComplete({ scheduleItems: [{ allDay: true, startTime: "08:00", endTime: "10:00" }] }), false);
assert.equal(validateSchedulingCompleteness("WINDOW", null), null);
assert.equal(validateSchedulingCompleteness(null, null), null);
assert.match(validateSchedulingCompleteness("SLOT", { scheduleItems: [{ startTime: "08:00" }] }) ?? "", /окончания/);

console.log("schedulingCompleteness tests: OK");
