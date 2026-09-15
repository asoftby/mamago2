import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./EventDateRangePicker.tsx", import.meta.url), "utf8");

test("legacy two-click hint copy is removed", () => {
  assert.doesNotMatch(source, /Первый клик выбирает/);
});

test("desktop and mobile reset actions clear the applied date filter", () => {
  assert.match(
    source,
    /const resetDateRange = \(\) => \{\s*dispatch\(\{ type: "reset" \}\);\s*onApply\(\{ whenPreset: null, dateFrom: null, dateTo: null \}\);\s*\};/,
  );

  const resetActions = [
    ...source.matchAll(
      /<MobileOverlayResetAction disabled=\{!draft\.from\} onClick=\{resetDateRange\} \/>/g,
    ),
  ];
  assert.equal(
    resetActions.length,
    2,
    "expected one applied-state reset action in the desktop popover footer and one in the mobile sheet footer",
  );
});

test("apply remains wired to the selected draft range", () => {
  assert.equal(
    source.match(/onApply\(\{ whenPreset: null, dateFrom: draft\.from, dateTo: draft\.to \}\)/g)?.length,
    2,
  );
});
