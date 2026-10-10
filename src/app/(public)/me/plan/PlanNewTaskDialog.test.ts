import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./PlanPageClient.tsx", import.meta.url), "utf8");
const day = readFileSync(new URL("./PlanDayList.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("./PlanNewTaskDialog.tsx", import.meta.url), "utf8");
const overlay = readFileSync(
  new URL("../../../../features/my-plan/components/MyPlanOverlay.tsx", import.meta.url),
  "utf8",
);

assert.match(dialog, /<PlanNewTaskScreen/);
assert.match(dialog, /style=\{MY_PLAN_V3_TOKENS\}/);
assert.match(overlay, /import \{ MY_PLAN_V3_TOKENS \}/);
assert.match(page, /const openCreate = \(\) => \{\s*setNewTaskOpen\(true\)/);
assert.match(page, /<PlanNewTaskDialog[\s\S]*?onSaved=\{\(date\) => \{[\s\S]*?selectDate\(date\)/);
assert.match(page, /const openEdit = \(item: SerializedPlanItem\) => \{[\s\S]*?setManualDialogOpen\(true\)/);
assert.match(page, /<ManualPlanEntryDialog/);
assert.equal((day.match(/\+ Добавить/g) ?? []).length, 1, "only header Add CTA remains");
assert.match(day, /Куда пойти →/);
console.log("Plan full-page create dialog and empty-state CTA: OK");
