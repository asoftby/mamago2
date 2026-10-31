import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

const summary = read("../../../../app/api/save/plan/summary/route.ts");
const store = read("../../hooks/useMyPlan.tsx");

assert.match(summary, /currentWeekEnd = addDaysIso\(from, \(7 - weekday\) % 7\)/);
assert.match(summary, /currentWeekItems:|currentWeekItems,/);
assert.match(store, /normalizePlanItemsFromApi\(data.currentWeekItems\)/);
console.log("My Plan current-week summary contracts: OK");
