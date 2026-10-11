import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("both My Plan surfaces open time editing for Telegram notes", () => {
  const modal = read("src/features/my-plan/components/PlanMainContent.tsx");
  const editor = read("src/features/my-plan/components/v3/PlanNewTaskScreen.tsx");
  const fullPlan = read("src/features/my-plan/lib/familyCalendar.ts");
  const dialog = read("src/app/(public)/me/plan/ManualPlanEntryDialog.tsx");
  assert.match(modal, /movingItem\?\.source === "TELEGRAM_FORWARD"/);
  assert.match(editor, /editItem\.source === "TELEGRAM_FORWARD"/);
  assert.match(editor, /endsAt: null/);
  assert.match(fullPlan, /canEdit: item\.source === "MANUAL" \|\| item\.source === "TELEGRAM_FORWARD"/);
  assert.match(dialog, /item\.source === "TELEGRAM_FORWARD"/);
});

test("Telegram plan edit is owner-scoped, versioned, source-restricted and never rewrites inbox", () => {
  const endpoint = read("src/app/api/plan/telegram/[id]/route.ts");
  const service = read("src/server/services/manualPlanEntry.service.ts");
  assert.match(endpoint, /getCurrentUser\(\)/);
  assert.match(endpoint, /status: 401/);
  assert.match(endpoint, /resolvePlanOwner\(user\.id\)/);
  assert.match(endpoint, /updateTelegramPlanEntry/);
  assert.doesNotMatch(endpoint, /\.\.\.body/);
  assert.doesNotMatch(endpoint, /inboxItemId: body/);
  assert.match(service, /source, status: "CONFIRMED", updatedAt: expected/);
  assert.match(service, /source:|source,/);
  assert.match(service, /activePlanScopeFor\(owner\.userId\)/);
});
