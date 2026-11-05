import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/activity/SaveToPlanModal.tsx", "utf8");
assert.match(source, /function SaveAudienceChips\(/);
assert.match(source, /<SaveAudienceChips \/>/);
assert.match(source, /useFamilyPersona\(\)/);
assert.match(source, /globalIds\.filter/);
assert.match(source, /setSelectedIds\(allSelected \? \[\] : allIds\)/);
assert.match(source, /selectedPersonaIds: selectedIds/);
assert.match(source, /result\.action === "plan"/);
assert.match(source, /aria-pressed=\{active\}/);

for (const filename of [
  "src/features/save/persistActivitySave.ts",
  "src/features/save/persistPlaceSave.ts",
  "src/components/event-page/EventPageView.tsx",
  "src/components/event-page/ConversionEventPageView.tsx",
  "src/components/offers/OfferPageView.tsx",
]) {
  const text = readFileSync(filename, "utf8");
  assert.match(text, /selectedPersonaIds: result\.selectedPersonaIds/, filename);
}
const api = readFileSync("src/app/api/save/plan/route.ts", "utf8");
assert.match(api, /buildSubjectsSnapshot\(/);
assert.match(api, /selectedPersonaIds/);
console.log("Save audience chips and persistence wiring: OK");
