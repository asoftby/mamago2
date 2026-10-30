import assert from "node:assert/strict";
import { validateRecurringTask } from "./recurringTask.service";

const base = {requestKey:"request_key_123456", title:"Тренировка", startTime:"17:00", reminderEnabled:true, reminderLeadMinutes:30, recurrence:{frequency:"WEEKLY", interval:1, startDate:"2026-10-29",weekdays:[4]}};
assert.equal(validateRecurringTask(base).time,"17:00");
for (const patch of [{requestKey:"tiny"},{title:""},{startTime:"25:00"},{reminderLeadMinutes:28 * 24 * 60 + 1},{reminderEnabled:false}]) assert.throws(()=>validateRecurringTask({...base,...patch}));

const withAssignment = { ...base, childId: "child-123" };
assert.equal(validateRecurringTask(withAssignment).childId, "child-123");
assert.throws(() => validateRecurringTask({ ...base, childId: "child-123", assigneeUserId: "adult-123" }), /assignee_and_child/);
assert.throws(() => validateRecurringTask({ ...base, childId: " " .repeat(200) }), /invalid_child/);
assert.throws(() => validateRecurringTask({ ...base, assigneeUserId: 15 as unknown as string }), /invalid_assignee/);

// Four-week reminder values must be accepted and excessive offsets rejected.
assert.equal(validateRecurringTask({ ...base, reminderLeadMinutes: 28 * 24 * 60 }).lead, 28 * 24 * 60);
assert.throws(() => validateRecurringTask({ ...base, reminderLeadMinutes: 28 * 24 * 60 + 1 }), /invalid_reminder/);
