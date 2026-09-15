import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./MyPlanPanelContent.tsx", import.meta.url), "utf8");

test("widget clamps persisted past dates to today before rendering plan content", () => {
  assert.match(source, /selectedPlanDate < todayIso \? todayIso : selectedPlanDate/);
  assert.match(source, /if \(!open \|\| !isAuthenticated \|\| selectedPlanDate >= todayIso\) return;/);
});

test("widget filters past dates and already-started items for today", () => {
  assert.match(source, /if \(item\.date < todayIso\) return false;/);
  assert.match(source, /startsAtMs >= nowMs/);
});

test("widget refuses date changes into the past", () => {
  assert.match(source, /setSelectedPlanDate\(date < todayIso \? todayIso : date\)/);
});
