/**
 * Static wiring check for Step4DateTime.tsx's imported-schedule safety flow.
 *
 * Imported sessions stay non-editable by default so unrelated wizard saves
 * cannot silently destroy source metadata. Editors must explicitly switch the
 * schedule to manual ownership; only after that server-side takeover succeeds
 * does the normal EventScheduleList become active.
 *
 * This test is part of test:abws-readonly-import-schedule, so it also checks
 * the server takeover boundary to keep UI and write-side protection coupled.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getDefaultFormData } from "../defaults";
import { validateForSubmit, validateStep } from "../validation";
import type { EventFormData } from "../types";

const source = readFileSync(
  "src/components/business/wizard/event/steps/Step4DateTime.tsx",
  "utf8",
);
const manualRouteSource = readFileSync(
  "src/app/api/business/events/[id]/schedule-source/manual/route.ts",
  "utf8",
);
const wizardSource = readFileSync(
  "src/components/business/wizard/event/EventWizard.tsx",
  "utf8",
);
const reviewSource = readFileSync(
  "src/components/business/wizard/event/steps/Step9Review.tsx",
  "utf8",
);

assert.match(
  source,
  /const readOnly = payload\.readOnly === true;[\s\S]*?setScheduleReadOnly\(readOnly\);[\s\S]*?onScheduleSourceStateChange\?\.\(\{ readOnly, itemCount: items\.length \}\);/,
  "must report protected schedule ownership and active item count to the parent wizard",
);
assert.match(
  source,
  /fetch\(`\/api\/business\/events\/\$\{eventId\}\/schedule-source\/manual`,\s*\{\s*method:\s*"POST"/,
  "manual editing must go through the explicit server takeover endpoint",
);
assert.match(
  source,
  /handleScheduleItemsChange\(nextItems\);\s*\n\s*setScheduleReadOnly\(false\);\s*\n\s*onScheduleSourceStateChange\?\.\(\{ readOnly: false, itemCount: nextItems\.length \}\);/,
  "must seed the wizard and clear authoritative ownership after explicit manual takeover",
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

assert.match(
  manualRouteSource,
  /canManageActivityById\(user, activityId\)/,
  "manual takeover must use normal event authorization",
);
assert.match(
  manualRouteSource,
  /prisma\.\$transaction\(async \(tx\)/,
  "takeover must run inside one transaction",
);
assert.match(
  manualRouteSource,
  /acquireActivityScheduleLock\(tx, activityId\)/,
  "takeover must serialize against concurrent import session writes",
);
const lockIndex = manualRouteSource.indexOf("acquireActivityScheduleLock(tx, activityId)");
const importedReadIndex = manualRouteSource.indexOf("tx.activitySession.findMany");
assert.ok(
  lockIndex !== -1 && importedReadIndex > lockIndex,
  "imported sessions must be read only after the schedule ownership lock is held",
);
assert.match(
  manualRouteSource,
  /findDuplicateStartsAt\(importedSessions\)/,
  "takeover must detect same-instant imported performances before clearing identity",
);
assert.match(
  manualRouteSource,
  /DUPLICATE_IMPORTED_SESSION_START/,
  "ambiguous same-instant imports must fail closed instead of collapsing ticket identities",
);
assert.match(
  manualRouteSource,
  /fieldName:\s*"scheduleJson"[\s\S]*?lockMode:\s*"PREFER_MANUAL"/,
  "takeover must persist manual ownership so later imports cannot overwrite schedule",
);
assert.match(
  manualRouteSource,
  /data:\s*\{\s*source:\s*null,\s*externalId:\s*null\s*}/,
  "takeover must clear import identity from current ActivitySession rows",
);
assert.doesNotMatch(
  manualRouteSource,
  /data:\s*\{[^}]*buyUrl:\s*null/,
  "takeover must not wipe ticket URLs",
);
assert.doesNotMatch(
  manualRouteSource,
  /data:\s*\{[^}]*priceMinCents:\s*null/,
  "takeover must not wipe imported prices",
);
assert.match(
  manualRouteSource,
  /scheduleItems:\s*takeover\.scheduleItems,\s*\n\s*manualOverride:\s*true/,
  "endpoint must return seeded editable schedule rows to the wizard",
);

assert.match(
  wizardSource,
  /fetch\(`\/api\/business\/events\/\$\{eventId\}\/schedule-source`/,
  "EventWizard must preload imported schedule ownership so a direct review-step load validates correctly",
);
assert.match(
  wizardSource,
  /onScheduleSourceStateChange=\{handleScheduleSourceStateChange\}/,
  "EventWizard must also receive ownership changes from Step4DateTime/manual takeover",
);
assert.match(
  wizardSource,
  /validateStep\(currentStep, formData, validationContext\)/,
  "continue-button validation must use imported schedule context",
);
assert.match(
  wizardSource,
  /validateForSubmit\(formData, validationContext\)/,
  "final submit validation must use imported schedule context",
);
assert.match(
  reviewSource,
  /validateForSubmit\(data, validationContext\)/,
  "review-step validation must use imported schedule context",
);

{
  const data = getDefaultFormData();
  const manual = validateStep(5, data);
  assert.equal(manual.isComplete, false, "empty manual schedule must remain incomplete");

  const imported = validateStep(5, data, { hasAuthoritativeSchedule: true });
  assert.equal(imported.isComplete, true, "active source-owned schedule must satisfy the schedule step");
  assert.equal(imported.isValid, true, "active source-owned schedule must not emit manual schedule errors");
}

{
  const data = getDefaultFormData();
  data.title = "Импортное событие";
  data.eventFormats = ["calm_relaxed"];
  data.categoryId = "category";
  data.primaryRootHasChildren = false;
  data.ageRangeIds = ["3-5"];
  data.fullDescription = "Достаточно длинное описание импортного события для проверки.";
  data.coverImage = "media-id";
  data.venueKind = "TBD";
  data.pricingMode = "free";
  data.participationMode = "walk-in";

  assert.equal(
    validateForSubmit(data).isValid,
    false,
    "without source ownership the same empty manual schedule must block submit",
  );
  assert.equal(
    validateForSubmit(data, { hasAuthoritativeSchedule: true }).isValid,
    true,
    "authoritative imported schedule must allow final submit when every other required step is complete",
  );
}

console.log("Step4DateTime imported schedule manual takeover + validation wiring test: OK");
