/**
 * Static wiring check for Step4DateTime.tsx's imported-schedule safety flow.
 *
 * Imported sessions stay non-editable by default so unrelated wizard saves
 * cannot silently destroy source metadata. Editors must explicitly switch the
 * schedule to manual ownership; only after that server-side takeover succeeds
 * does the normal EventScheduleList become active.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/business/wizard/event/steps/Step4DateTime.tsx",
  "utf8",
);

assert.match(
  source,
  /setScheduleReadOnly\(payload\.readOnly === true\)/,
  "must derive protected state from schedule-source readOnly",
);

assert.match(
  source,
  /fetch\(`\/api\/business\/events\/\$\{eventId\}\/schedule-source\/manual`,\s*\{\s*method:\s*"POST"/,
  "manual editing must go through the explicit server takeover endpoint",
);

assert.match(
  source,
  /handleScheduleItemsChange\(nextItems\);\s*\n\s*setScheduleReadOnly\(false\);/,
  "must seed the wizard from server-returned sessions before unlocking the editor",
);

assert.match(
  source,
  /Редактировать расписание вручную/,
  "protected imported schedule must expose an explicit manual-edit action",
);

const readOnlyBranchStart = source.indexOf("{scheduleReadOnly ? (");
const readOnlyBranchEnd = source.indexOf(") : (", readOnlyBranchStart);
assert.ok(readOnlyBranchStart !== -1 && readOnlyBranchEnd !== -1, "could not locate the scheduleReadOnly ternary");
const readOnlyBranch = source.slice(readOnlyBranchStart, readOnlyBranchEnd);

assert.ok(
  !readOnlyBranch.includes("<EventScheduleList"),
  "import-owned schedule must not expose EventScheduleList before explicit takeover",
);

const eventScheduleListIndex = source.indexOf("<EventScheduleList");
assert.ok(eventScheduleListIndex !== -1, "EventScheduleList must still be rendered after takeover/for ordinary events");
assert.ok(
  eventScheduleListIndex > readOnlyBranchEnd,
  "EventScheduleList must stay in the non-protected branch",
);
assert.equal(
  source.indexOf("<EventScheduleList", eventScheduleListIndex + 1),
  -1,
  "EventScheduleList must be rendered exactly once",
);

console.log("Step4DateTime imported schedule manual takeover wiring test: OK");
