import assert from "node:assert/strict";
import { getEventSaveStatusLabel } from "./eventSaveStatusLabel";

assert.equal(getEventSaveStatusLabel({ inPlan: false, isIdea: false }), null);
assert.equal(getEventSaveStatusLabel({ inPlan: true, isIdea: false }), "В плане");
assert.equal(getEventSaveStatusLabel({ inPlan: false, isIdea: true }), "В идеях");
assert.equal(getEventSaveStatusLabel({ inPlan: true, isIdea: true }), "В плане и идеях");

console.log("Event saved status labels: OK");
