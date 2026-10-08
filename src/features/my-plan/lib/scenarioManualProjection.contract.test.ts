import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("Scenario page and save API use the shared PlanItem interval projector", () => {
  for (const path of [
    "src/app/(public)/[city]/my-plan/[date]/scenario/page.tsx",
    "src/app/api/plan/scenario/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /resolvePlanItemScenarioScheduling\(/);
    assert.match(source, /endsAt: (?:item|row)\.endsAt/);
    assert.doesNotMatch(source, /resolveScenarioScheduling\(\{ activity:/);
  }
});

test("manual mutation routes return the shared calendar projection", () => {
  for (const path of [
    "src/app/api/plan/manual/route.ts",
    "src/app/api/plan/manual/[id]/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /loadFamilyCalendarItem\(\{ owner, item \}\)/);
  }
});

test("My Plan cache applies schedule-aware Scenario status updates", () => {
  const source = read("src/app/(public)/me/plan/PlanPageClient.tsx");
  assert.match(source, /scenarioStatusesAfterManualSave\(current, editingManualItem, saved\)/);
  assert.match(source, /scenarioStatusesAfterManualCancel\(current, removed\)/);
});
