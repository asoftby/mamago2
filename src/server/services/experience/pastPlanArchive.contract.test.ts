import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const history = readFileSync(new URL("./pastPlanEntries.service.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../app/(public)/me/plan/page.tsx", import.meta.url), "utf8");
const archive = readFileSync(new URL("../../../app/(public)/me/plan/PastPlanArchive.tsx", import.meta.url), "utf8");
const checkIn = readFileSync(new URL("../../../app/(public)/me/plan/ExperienceCheckIn.tsx", import.meta.url), "utf8");

test("history is scoped to visible family plans and excludes future dates", () => {
  assert.match(history, /activePlanScopeFor\(input\.userId\)/);
  assert.match(history, /date:\s*\{ lt: getLocalDateKey\(\) \}/);
  assert.match(history, /take: PAGE_SIZE \+ 1/);
  assert.match(history, /skip: page \* PAGE_SIZE/);
});

test("history includes places, offers, manually entered tasks, and attendance states", () => {
  assert.match(history, /row\.placeId/);
  assert.match(history, /row\.activity\?\.type === "OFFER"/);
  assert.match(history, /row\.entryType === "TASK"/);
  assert.match(history, /sourcePlanItemId/);
  assert.match(archive, /Прошедшее/);
  assert.match(archive, /Ждёт оценки/);
  assert.match(archive, /Не получилось/);
  assert.match(page, /listPastPlanEntries/);
});

test("check-in is optional and can be postponed without losing history", () => {
  assert.match(checkIn, /Оценить →/);
  assert.match(checkIn, /Напомнить завтра/);
  assert.match(checkIn, /experience-snooze/);
  assert.match(checkIn, /setTimeout\(\(\) => setExitState\("hidden"\), 3000\)/);
});
