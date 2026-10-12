import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDefaultFormData } from "./defaults";
import { getOfferTypeSelection } from "./offerTypeChoices";
import { createRequire } from "node:module";
import { Step2Placements } from "./steps/Step2Placements";
import { AdditionalPlacements } from "./components/AdditionalPlacements";
import type { OfferProductType } from "./types";

const allTypes: OfferProductType[] = [
  "PLACE_VISIT", "ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY", "CAMP", "PARTY_SERVICE", "PARTY_PACKAGE",
];
async function main() {
const require = createRequire(import.meta.url);
// Node-based SSR assertions: no browser stylesheet loader is necessary.
require.extensions[".css"] = () => undefined;
const { getStepsForOfferType, getNextStepKey, getStepNumber, isStepComplete } = await import("./offerWizardSteps.config");
const { validateForSubmit } = await import("./validation");
for (const productType of allTypes) {
  const defaults = getDefaultFormData(null);
  const selection = getOfferTypeSelection(productType);
  const data = { ...defaults, ...selection };
  const steps = getStepsForOfferType(data.offerWizardType, data.productType);
  const keys = steps.map((step) => step.key);
  assert.equal(keys[0], "type", productType);
  const publicationErrors = validateForSubmit(data).errors.join("; ");
  assert.ok(!publicationErrors.includes("характеристики предложения"), `${productType}: optional internal tags do not block publication`);
  assert.equal(keys.at(-1), "review", productType);
  assert.ok(!keys.includes("faq"), `${productType}: optional FAQ is not a step`);
  const isParty = productType === "PARTY_SERVICE" || productType === "PARTY_PACKAGE";
  assert.equal(keys.includes("placements"), isParty, `${productType}: no second catalog choice`);
  assert.equal(keys.includes("conditions"), !isParty && productType !== "CAMP", `${productType}: one conditions step`);
  assert.equal(
    getNextStepKey(data.offerWizardType, "type", data.productType),
    isParty ? "placements" : "details",
    productType,
  );
  assert.equal(getStepNumber(data.offerWizardType, "review", data.productType), steps.length);
  if (!isParty) {
    const html = renderToStaticMarkup(createElement(AdditionalPlacements, {
      data, onChange: () => undefined, isEditable: true,
    }));
    assert.ok(html.includes("Другие разделы каталога"));
    assert.ok(html.includes("(основной)"));
  } else {
    const html = renderToStaticMarkup(createElement(Step2Placements, {
      data, onChange: () => undefined, isEditable: true,
    }));
    assert.ok(html.includes("Где проходит?"), `${productType}: party format`);
    assert.ok(html.includes("Продолжительность"), `${productType}: duration`);
    assert.ok(html.includes("Что входит?"), `${productType}: one inclusion field`);
    assert.ok(html.includes("Дополнительно"), `${productType}: optional fields collapsed`);
    assert.ok(!html.includes("Выберите сценарии"));
    assert.ok(!html.includes("модератор"));
    assert.ok(!html.includes("конструктор"));
    assert.ok(!isStepComplete("placements", data), `${productType}: required party info not silently skipped`);
    data.birthdayDetails.locationType = "ON_SITE";
    data.birthdayDetails.included = "Аренда зала и ведущий";
    if (productType === "PARTY_SERVICE") data.partyCategory = "ANIMATOR";
    assert.ok(isStepComplete("placements", data), `${productType}: required info completes step`);
  }
}
console.log("offerWizardSimplification tests passed");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
