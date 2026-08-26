import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./EventDateRangePicker.tsx", import.meta.url), "utf8");

test("legacy two-click hint copy is removed", () => {
  assert.doesNotMatch(source, /Первый клик выбирает/);
});

test("desktop and mobile footers both wire a disabled-aware reset that only clears the draft", () => {
  const resetCalls = [...source.matchAll(/<MobileOverlayResetAction disabled=\{!draft\.from\} onClick=\{\(\) => dispatch\(\{ type: "reset" \}\)\} \/>/g)];
  assert.equal(resetCalls.length, 2, "expected one reset action in the desktop popover footer and one in the mobile sheet footer");
});

test("apply stays wired to onApply and reset never calls onApply directly", () => {
  assert.equal(source.match(/onApply\(\{ whenPreset: null, dateFrom: draft\.from, dateTo: draft\.to \}\)/g)?.length, 2);
  assert.doesNotMatch(source, /type: "reset" \}\); onApply/);
});
