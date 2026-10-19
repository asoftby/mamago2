import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanStickyCounter } from "./PlanStickyCounter";

const noop = () => undefined;

// Inside the widget sheet the button stays absolute and relies on the sheet's own tokens.
const inWidget = renderToStaticMarkup(createElement(PlanStickyCounter, { onAdd: noop }));
assert.match(inWidget, /absolute/);
assert.doesNotMatch(inWidget, /fixed/);
assert.doesNotMatch(inWidget, /style=/); // no token overrides: the sheet defines them

// On the plan page it floats over the viewport and carries its own v3 tokens (no ancestor defines them there).
const onPage = renderToStaticMarkup(createElement(PlanStickyCounter, { onAdd: noop, floating: true }));
assert.match(onPage, /fixed/);
assert.match(onPage, /--mp-ac:var\(--primary\)/);
assert.match(onPage, /Что нужно сделать\?/);
assert.match(onPage, /max-w-\[560px\]/);

// Without a handler nothing renders.
assert.equal(renderToStaticMarkup(createElement(PlanStickyCounter, {})), "");

// The plan page wires the same button to the same new-task dialog and keeps content clear of it.
const page = readFileSync("src/app/(public)/me/plan/PlanPageClient.tsx", "utf8");
assert.match(page, /<PlanStickyCounter floating onAdd=\{openCreate\} \/>/);
assert.match(page, /!newTaskOpen && !manualDialogOpen/);
// The widget shell is deliberately not mounted on full-page plan routes, so there is exactly one floating button.
const provider = readFileSync("src/components/MyPlanProvider.tsx", "utf8");
assert.match(provider, /!isFullPageRoute && pathname/);

console.log("PlanStickyCounter.test.tsx: OK");
