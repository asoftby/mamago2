import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { getStepsForOfferType } from "../../components/business/wizard/offer/offerWizardSteps.config";
import { getOfferTypeSelection } from "../../components/business/wizard/offer/offerTypeChoices";

test("All offer types render the same six-step V2 flow, including an empty initial selection", () => {
  const expected = ["type", "about", "services", "schedule", "terms", "review"];
  assert.deepEqual(getStepsForOfferType(null, null, "v2").map((step) => step.key), expected);
  for (const productType of [
    "PLACE_VISIT", "ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY",
    "CAMP", "PARTY_SERVICE", "PARTY_PACKAGE",
  ] as const) {
    const selection = getOfferTypeSelection(productType);
    assert.deepEqual(
      getStepsForOfferType(selection.offerWizardType, productType, "v2").map((step) => step.key),
      expected, productType,
    );
  }
});

test("OfferWizard always renders V2 for admin and business create/edit regardless of feature flags", () => {
  const wizard = readFileSync("src/components/business/wizard/offer/OfferWizard.tsx", "utf8");
  assert.match(wizard, /const variant: OfferWizardVariant = "v2";/);
  assert.doesNotMatch(wizard, /newWizard/);
  for (const page of [
    "src/app/(content-editor)/editor/offer/new/page.tsx",
    "src/app/(content-editor)/editor/offer/[id]/edit/page.tsx",
  ]) {
    const code = readFileSync(page, "utf8");
    assert.match(code, /<OfferWizard/);
    assert.doesNotMatch(code, /newWizard|isOfferWizardV2Enabled/);
  }
  const features = readFileSync("src/lib/business/businessFeatures.ts", "utf8");
  assert.doesNotMatch(features, /newOfferWizard|OFFER_WIZARD_V2_DEV_ENABLED/);
});
