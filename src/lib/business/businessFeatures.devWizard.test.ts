import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("All offer types and unselected new offers use six-step V2 without loading UI dependencies", () => {
  const config = readFileSync("src/components/business/wizard/offer/offerWizardSteps.config.ts", "utf8");
  // The V2 selection must occur BEFORE the null-type legacy fallback.
  assert.match(config, /if \(variant === "v2"\) return V2_STEPS;\s*if \(!type\) return \[\];/);
  const steps = readFileSync("src/components/business/wizard/offer/offerWizardV2Steps.ts", "utf8");
  for (const key of ["type", "about", "services", "schedule", "terms", "review"]) {
    assert.ok(steps.includes(`key: "${key}"`), `V2 includes ${key}`);
  }
  const types = readFileSync("src/components/business/wizard/offer/offerTypeChoices.ts", "utf8");
  for (const productType of [
    "PLACE_VISIT", "ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY",
    "CAMP", "PARTY_SERVICE", "PARTY_PACKAGE",
  ]) {
    assert.ok(types.includes(`${productType}: {`), `all six offer types are supported: ${productType}`);
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
