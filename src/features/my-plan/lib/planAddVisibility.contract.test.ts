import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// Server: visibility is honored only with FAMILY_CORE_READS, validated to the two enum values,
// and PLAN_ADD events carry it (a PRIVATE add must never surface in a family feed).
const route = read("src/app/api/save/plan/route.ts");
assert.match(route, /familyReadsEnabled\(\) && \(visibilityRaw === "PRIVATE" \|\| visibilityRaw === "FAMILY"\)/);
assert.equal((route.match(/eventType: "PLAN_ADD",\n\s+planVisibility: visibility,/g) ?? []).length, 3);

const plan = read("src/server/services/plan.service.ts");
assert.equal((plan.match(/\.\.\.\(options\?\.visibility \? \{ visibility: options\.visibility \} : \{\}\)/g) ?? []).length, 2);
assert.match(plan, /\.\.\.\(visibility \? \{ visibility \} : \{\}\)/);

// Client: the switch exists only for flows that forward `visibility` to the server.
const forwarders = [
  "src/features/save/persistActivitySave.ts",
  "src/features/save/persistPlaceSave.ts",
  "src/components/event-page/EventPageView.tsx",
];
for (const f of forwarders) {
  assert.match(read(f), /result\.visibility \? \{ visibility: result\.visibility \}/, `${f} must forward visibility`);
}
for (const f of [
  "src/components/event-page/EventPageView.tsx",
  "src/features/save/SaveHeart.tsx",
  "src/features/save/PlaceSaveHeart.tsx",
]) {
  assert.match(read(f), /showVisibilityToggle/, `${f} enables the switch`);
}
// Nobody else may enable it (their results do not reach the server).
import { execSync } from "node:child_process";
const enablers = execSync("grep -rl 'showVisibilityToggle' src --include=*.tsx --include=*.ts || true", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.endsWith(".contract.test.ts"));
const allowed = new Set([
  "src/components/activity/SaveToPlanModal.tsx",
  "src/components/activity/SaveActivityFlowAdaptive.tsx",
  "src/components/event-page/EventPageView.tsx",
  "src/features/save/SaveHeart.tsx",
  "src/features/save/PlaceSaveHeart.tsx",
]);
for (const f of enablers) assert.ok(allowed.has(f), `${f}: unexpected showVisibilityToggle`);

const modal = read("src/components/activity/SaveToPlanModal.tsx");
assert.match(modal, /!\(inPlan && planDate\)/, "switch only for new items");
assert.match(modal, /useState\(true\)/, "shared by default, never remembered");
console.log("planAddVisibility.contract.test: ok");
