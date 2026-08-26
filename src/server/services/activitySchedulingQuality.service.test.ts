import assert from "node:assert/strict";
import { classifyActivitySchedulingQuality } from "./activitySchedulingQuality.service";

assert.equal(classifyActivitySchedulingQuality({ schedulingKind: null, scheduleJson: null }), "UNKNOWN");
assert.equal(classifyActivitySchedulingQuality({ schedulingKind: "SLOT", scheduleJson: { scheduleItems: [{ startTime: "12:00" }] } }), "SLOT_INCOMPLETE");
assert.equal(classifyActivitySchedulingQuality({ schedulingKind: "SLOT", scheduleJson: { scheduleItems: [{ startTime: "12:00", endTime: "13:00" }] } }), "COMPLETE");
assert.equal(classifyActivitySchedulingQuality({ schedulingKind: "WINDOW", scheduleJson: null }), "COMPLETE");

console.log("activitySchedulingQuality service tests: OK");
