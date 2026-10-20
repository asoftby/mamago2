import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

const summary = read("../../../../app/api/save/plan/summary/route.ts");
const store = read("../../hooks/useMyPlan.tsx");
const modal = read("../PlanMainContent.tsx");
const screen = read("./PlanWeekScreen.tsx");

assert.match(summary, /currentWeekEnd = addDaysIso\(from, \(7 - weekday\) % 7\)/);
assert.match(summary, /currentWeekItems:|currentWeekItems,/);
assert.match(store, /normalizePlanItemsFromApi\(data.currentWeekItems\)/);
assert.match(modal, /На этой неделе/);
assert.match(modal, /Посмотреть все/);
assert.match(modal, /openNestedScreen\("week"\)/);
assert.match(modal, /<PlanWeekScreen/);
assert.match(modal, /onSelectDate=\{\(date\) => \{/);
assert.match(screen, /onSelectDate\(date\)/);
assert.match(screen, /PlanScreenTitleHead/);
console.log("My Plan current-week slide contracts: OK");
