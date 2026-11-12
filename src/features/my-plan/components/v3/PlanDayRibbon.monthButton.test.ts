import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ribbon = readFileSync(new URL("./PlanDayRibbon.tsx", import.meta.url), "utf8");
const parent = readFileSync(new URL("../PlanMainContent.tsx", import.meta.url), "utf8");

test("month view is a calendar icon beside Today without the full-width month tile", () => {
  assert.match(ribbon, /aria-label="Показать весь месяц"/);
  assert.match(ribbon, /title="Весь месяц"/);
  assert.match(ribbon, /onClick=\{onOpenMonth\}/);
  assert.match(ribbon, /<CalendarDays/);
  assert.match(ribbon, /Сегодня/);
  assert.doesNotMatch(ribbon, /border-dashed/);
  assert.doesNotMatch(ribbon, />Весь месяц<\/span>/);
  assert.match(parent, /onOpenMonth=\{\(\) => openNestedScreen\("month"\)\}/);
  assert.match(parent, /<PlanMonthScreen/);
});
