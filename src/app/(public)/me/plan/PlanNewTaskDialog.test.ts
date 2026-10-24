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
assert.match(overlay, /heightMode="tall"/, "plan and new-task slides share the same mobile sheet shell");
assert.match(overlay, /!h-\[min\(90dvh,760px\)\]/, "desktop plan overlay height must stay fixed when sliding");
const planMain = readFileSync(
  new URL("../../../../features/my-plan/components/PlanMainContent.tsx", import.meta.url),
  "utf8",
);
const newTask = readFileSync(
  new URL("../../../../features/my-plan/components/v3/PlanNewTaskScreen.tsx", import.meta.url),
  "utf8",
);
assert.match(planMain, /relative flex min-h-0 flex-1 flex-col w-full overflow-hidden/, "slides fill overlay without intrinsic growth");
assert.match(planMain, /flex min-h-0 flex-1 w-\[200%\] transform-gpu transition-transform/, "horizontal slide occupies bounded height");
assert.match(newTask, /data-plan-new-task-scroll[\s\S]*?overflow-y-auto overscroll-y-contain touch-pan-y/, "task content scrolls inside fixed overlay");
assert.match(newTask, /shrink-0 border-t/, "save button remains anchored below scroll area");
assert.match(page, /const openCreate = \(\) => \{\s*setNewTaskOpen\(true\)/);
assert.match(page, /<PlanNewTaskDialog[\s\S]*?onSaved=\{\(date\) => \{[\s\S]*?selectDate\(date\)/);
assert.match(page, /const openEdit = \(item: SerializedPlanItem\) => \{[\s\S]*?setManualDialogOpen\(true\)/);
assert.match(page, /<ManualPlanEntryDialog/);
assert.equal((day.match(/\+ Добавить/g) ?? []).length, 0, "day header no longer duplicates the fixed add CTA");
assert.match(page, /<PlanStickyCounter floating onAdd=\{openCreate\}/, "page reuses the floating task action");
assert.equal((page.match(/<PlanStickyCounter /g) ?? []).length, 1, "only one sticky add task bar");
assert.match(day, /Куда пойти →/);
console.log("Plan full-page create dialog and empty-state CTA: OK");
