import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./MyPlanPanelContent.tsx", import.meta.url), "utf8");

test("widget keeps past days selectable and shows them in full", () => {
  assert.match(source, /if \(item\.date < todayIso\) return true;/);
  assert.doesNotMatch(source, /date < todayIso \? todayIso : date/);
});

test("widget hides already-started items only for today", () => {
  assert.match(source, /startsAtMs >= nowMs/);
  assert.match(source, /if \(item\.date > todayIso \|\| item\.startsAt == null\) return true;/);
});
