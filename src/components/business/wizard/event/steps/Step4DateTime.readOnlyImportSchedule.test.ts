/**
 * Static wiring check for Step4DateTime.tsx's read-only-import-schedule
 * branch. No React test harness in this repo (no testing-library/jsdom), and
 * this component's read-only state is only ever set from inside a
 * useEffect's async fetch — which react-dom/server's renderToStaticMarkup
 * does not execute (effects are client-only), so a single-pass SSR render
 * can never observe the true branch either. Same technique used elsewhere in
 * this codebase for state that only client effects can drive: assert on the
 * source directly.
 *
 * Regression target: when /schedule-source reports readOnly: true (imported
 * sessions exist), the wizard must not render an editable EventScheduleList
 * for this step — editing it would silently no-op on save (see
 * route.readonlyImportSchedule.test.ts for the server-side half of this).
 *
 * Запуск: npx tsx src/components/business/wizard/event/steps/Step4DateTime.readOnlyImportSchedule.test.ts
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
  "must derive read-only state from the schedule-source endpoint's readOnly flag",
);

assert.match(
  source,
  /\{scheduleReadOnly \? \(/,
  "must branch the render on scheduleReadOnly",
);

const readOnlyBranchStart = source.indexOf("{scheduleReadOnly ? (");
const readOnlyBranchEnd = source.indexOf(") : (", readOnlyBranchStart);
assert.ok(readOnlyBranchStart !== -1 && readOnlyBranchEnd !== -1, "could not locate the scheduleReadOnly ternary");
const readOnlyBranch = source.slice(readOnlyBranchStart, readOnlyBranchEnd);

assert.ok(
  !readOnlyBranch.includes("<EventScheduleList"),
  "the read-only branch must not render an editable EventScheduleList",
);

const eventScheduleListIndex = source.indexOf("<EventScheduleList");
assert.ok(eventScheduleListIndex !== -1, "EventScheduleList must still be rendered somewhere");
assert.ok(
  eventScheduleListIndex > readOnlyBranchEnd,
  "ordinary (non-imported) events must keep rendering the editable EventScheduleList, in the non-read-only branch",
);
assert.equal(
  source.indexOf("<EventScheduleList", eventScheduleListIndex + 1),
  -1,
  "EventScheduleList must be rendered exactly once — never duplicated into the read-only branch",
);

console.log("Step4DateTime read-only import schedule wiring test: OK");
