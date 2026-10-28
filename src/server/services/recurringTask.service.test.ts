import assert from "node:assert/strict";
import { validateRecurringTask } from "./recurringTask.service";

const base = {requestKey:"request_key_123456", title:"Тренировка", startTime:"17:00", reminderEnabled:true, reminderLeadMinutes:30, recurrence:{frequency:"WEEKLY", interval:1, startDate:"2026-10-29",weekdays:[4]}};
assert.equal(validateRecurringTask(base).time,"17:00");
for (const patch of [{requestKey:"tiny"},{title:""},{startTime:"25:00"},{reminderLeadMinutes:1500},{reminderEnabled:false}]) assert.throws(()=>validateRecurringTask({...base,...patch}));
