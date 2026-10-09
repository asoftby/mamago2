import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./PlanMainContent.tsx", import.meta.url), "utf8");

test("past day in the widget shows records only, with the empty-state copy", () => {
  assert.match(source, /const isPastDay = selectedDate < todayKey;/);
  assert.match(source, /В этот день записей не было/);
});

test("both layouts route past days around recommendations, fork, CTA and scenario button", () => {
  const guarded = source.match(/\{isPastDay \? \(\n\s+renderPastDay\((true|false)\)/g) ?? [];
  assert.equal(guarded.length, 2);
  // recommendation area / scenario button live only inside the non-past branch
  const pastFn = source.slice(source.indexOf("const renderPastDay"), source.indexOf("const renderRecommendationArea"));
  assert.doesNotMatch(pastFn, /renderRecommendationArea|renderBottomActions|BuildScenarioButton|RecommendationDecisionBlock/);
});
