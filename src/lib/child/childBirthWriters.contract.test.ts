import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const writers = [
  "src/components/post-auth/ProfileCompletionFlow.tsx",
  "src/components/children/AddParticipantModal.tsx",
  "src/components/children/QuickAddChildModal.tsx",
  "src/features/city-home/components/FamilyActivationAddChildOverlay.tsx",
  "src/features/my-plan/hooks/useMyPlan.tsx",
  "src/features/birthday/builder/components/PartyForChildSection.tsx",
];

for (const file of writers) {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");
  assert.equal(/new Date\([^\n]*(?:,\s*1|,\s*15)(?:,|\))/.test(source), false, `${file} must not invent Child DOB anchors`);
}

console.log("childBirthWriters.contract.test.ts: OK");
