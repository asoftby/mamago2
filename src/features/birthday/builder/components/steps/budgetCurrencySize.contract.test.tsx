import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BelarusianRubleIcon } from "@/components/icons/BelarusianRubleIcon";

// Both budget selectors use the same BYN glyph, visually matched to the amount.
for (const file of ["StepFormat.tsx", "StepBudget.tsx"]) {
  const source = readFileSync(`src/features/birthday/builder/components/steps/${file}`, "utf8");
  assert.equal(
    source.match(/<BelarusianRubleIcon size="text" \/>/g)?.length,
    4,
    `${file}: all four budget labels must use the proportional currency icon`,
  );
  assert.doesNotMatch(source, /<BelarusianRubleIcon\s*\/>/);
  assert.match(source, /<BelarusianRubleIcon size="text" \/><\/span><span>и выше<\/span>/);
  assert.equal((source.match(/inline-flex items-center gap-\[0\.18em\]/g) ?? []).length, 4);
}

const formatSource = readFileSync("src/features/birthday/builder/components/steps/StepFormat.tsx", "utf8");
for (const caption of [
  "Рассмотрим варианты немного дороже",
  "Допустим небольшое отклонение от бюджета",
  "Покажем варианты рядом с вашим бюджетом",
  "Бюджет без верхнего ограничения",
  "Укажите примерный бюджет",
]) {
  assert.ok(formatSource.includes(caption), `Missing budget description: ${caption}`);
}
assert.match(formatSource, /sub=\{b\.sub\}/);

const icon = renderToStaticMarkup(createElement(BelarusianRubleIcon, { size: "text" }));
assert.match(icon, /height:0\.75em/);
assert.match(icon, /vertical-align:middle/);
assert.match(icon, /stroke-width="28"/);
assert.match(icon, /translateY\(0\.025em\)/);

console.log("budgetCurrencySize.contract.test.tsx: OK");
