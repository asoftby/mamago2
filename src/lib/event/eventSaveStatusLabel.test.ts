import assert from "node:assert/strict";
import { getEventSaveStatusLabel } from "./eventSaveStatusLabel";
import { formatPlanDateShort } from "./eventActionState";

assert.equal(getEventSaveStatusLabel({ inPlan: false, isIdea: false }), null);
assert.equal(getEventSaveStatusLabel({ inPlan: true, isIdea: false }), "В плане");
assert.equal(getEventSaveStatusLabel({ inPlan: false, isIdea: true }), "В идеях");
assert.equal(getEventSaveStatusLabel({ inPlan: true, isIdea: true }), "В плане и идеях");
assert.equal(
  getEventSaveStatusLabel({ inPlan: true, isIdea: false, planDate: "2026-11-24" }),
  `В плане на ${formatPlanDateShort("2026-11-24")}`,
);
assert.equal(
  getEventSaveStatusLabel({ inPlan: true, isIdea: true, planDate: "2026-11-24" }),
  `В плане на ${formatPlanDateShort("2026-11-24")}`,
);
assert.equal(formatPlanDateShort("2026-11-24"), "24 ноя.");
assert.equal(formatPlanDateShort("2026-11-13"), "13 ноя.");

console.log("Event saved status labels: OK");
