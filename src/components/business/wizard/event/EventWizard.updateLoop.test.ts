/**
 * Regression guard for EventWizard schedule-source state.
 *
 * Create mode omits initialScheduleSourceState. A fresh object literal as the
 * default prop becomes a new dependency on every render; an effect that then
 * calls setScheduleSourceState creates a render -> effect -> setState loop and
 * React throws "Maximum update depth exceeded" (#185).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/business/wizard/event/EventWizard.tsx",
  "utf8",
);

assert.match(
  source,
  /const EMPTY_SCHEDULE_SOURCE_STATE: ScheduleSourceState = Object\.freeze\(/,
  "schedule-source default must have stable module identity",
);

assert.match(
  source,
  /initialScheduleSourceState = EMPTY_SCHEDULE_SOURCE_STATE/,
  "EventWizard must not allocate the default schedule-source object during render",
);

assert.match(
  source,
  /current\.readOnly === next\.readOnly && current\.itemCount === next\.itemCount[\s\S]*\? current[\s\S]*: next/,
  "schedule-source setter must bail out when primitive values did not change",
);

assert.match(
  source,
  /\[eventId, initialScheduleSourceReadOnly, initialScheduleSourceItemCount\]/,
  "schedule-source effect must depend on primitive values, not object identity",
);

assert.doesNotMatch(
  source,
  /initialScheduleSourceState\s*=\s*\{\s*readOnly:\s*false,\s*itemCount:\s*0\s*\}/,
  "inline object default would reintroduce the React update loop",
);

console.log("EventWizard.updateLoop.test.ts: OK");
