import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("calendar and manual routes require auth and keep domain logic in owner-scoped services", () => {
  for (const path of [
    "src/app/api/plan/calendar/route.ts",
    "src/app/api/plan/manual/route.ts",
    "src/app/api/plan/manual/[id]/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /getCurrentUser\(\)/);
    assert.match(source, /status: 401/);
    assert.match(source, /resolvePlanOwner\(user\.id\)/);
  }
  const createRoute = read("src/app/api/plan/manual/route.ts");
  assert.doesNotMatch(createRoute, /\.\.\.body/);
  assert.doesNotMatch(createRoute, /userId:\s*body/);
  assert.doesNotMatch(createRoute, /source:\s*body/);
});

test("My Plan uses bounded calendar ranges, URL date state, cached weeks, and visible navigation", () => {
  const page = read("src/app/(public)/me/plan/page.tsx");
  const client = read("src/app/(public)/me/plan/PlanPageClient.tsx");
  const week = read("src/app/(public)/me/plan/WeekCalendar.tsx");
  assert.doesNotMatch(page, /listAllPlanItems/);
  assert.match(page, /loadFamilyCalendarRange/);
  assert.match(client, /\/api\/plan\/calendar\?from=/);
  assert.match(client, /shouldFetchCalendarWeek/);
  assert.match(client, /router\.replace/);
  assert.match(week, /getPrevWeekStart/);
  assert.match(week, /getNextWeekStart/);
  assert.match(week, /Сегодня/);
});

test("manual actions stay manual-only and Telegram remains non-editable", () => {
  const card = read("src/app/(public)/me/plan/PlanItemCard.tsx");
  const presentation = read("src/features/my-plan/lib/familyCalendar.ts");
  assert.match(presentation, /canEdit:\s*item\.source === "MANUAL"/);
  assert.match(card, /item\.source !== "TELEGRAM_FORWARD"/);
  assert.match(card, /\/api\/plan\/manual\//);
  assert.match(card, /presentation\.canEdit/);
});

test("manual edit and cancel send version and refresh after a conflict", () => {
  const dialog = read("src/app/(public)/me/plan/ManualPlanEntryDialog.tsx");
  const card = read("src/app/(public)/me/plan/PlanItemCard.tsx");
  const client = read("src/app/(public)/me/plan/PlanPageClient.tsx");
  const route = read("src/app/api/plan/manual/[id]/route.ts");
  const service = read("src/server/services/manualPlanEntry.service.ts");
  assert.match(dialog, /expectedUpdatedAt: item\.updatedAt/);
  assert.match(card, /expectedUpdatedAt: item\.updatedAt/);
  assert.match(dialog, /response\.status === 409/);
  assert.match(card, /res\.status === 409/);
  assert.match(client, /onConflict=\{/);
  assert.match(client, /router\.refresh\(\)/);
  assert.match(route, /error\.code === "CONFLICT" \? 409/);
  assert.match(service, /updatedAt: expected/);
  assert.match(service, /activePlanScopeFor\(owner\.userId\)/);
});
