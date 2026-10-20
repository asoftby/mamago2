import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

const overlay = read("./MyPlanOverlay.tsx");
const plan = read("./PlanMainContent.tsx");
const shared = read("../../../components/ui/responsive-overlay.tsx");

assert.match(plan, /data-plan-delete-toast/);
assert.match(plan, /restorePendingPlanItem\(itemId\)/);
assert.match(overlay, /onInteractOutside=\{\(event\) =>/);
assert.match(overlay, /target\.closest\("\[data-plan-delete-toast\]"\)/);
assert.match(overlay, /event\.preventDefault\(\)/);
assert.match(shared, /onInteractOutside=\{onInteractOutside\}/);
console.log("My Plan undo action does not dismiss the modal: OK");
