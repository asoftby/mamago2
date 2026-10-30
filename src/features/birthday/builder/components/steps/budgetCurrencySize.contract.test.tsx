import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BelarusianRubleIcon } from "@/components/icons/BelarusianRubleIcon";

// Both budget selectors must use the smaller currency glyph for every range.
for (const file of ["StepFormat.tsx", "StepBudget.tsx"]) {
  const source = readFileSync(`src/features/birthday/builder/components/steps/${file}`, "utf8");
  assert.equal(
    source.match(/<BelarusianRubleIcon size="text" \/>/g)?.length,
    4,
    `${file}: all four budget labels must use the proportional currency icon`,
  );
  assert.doesNotMatch(source, /<BelarusianRubleIcon\s*\/>/);
}

const icon = renderToStaticMarkup(createElement(BelarusianRubleIcon, { size: "text" }));
assert.match(icon, /height:0\.7em/);
assert.match(icon, /vertical-align:-0\.06em/);

console.log("budgetCurrencySize.contract.test.tsx: OK");
