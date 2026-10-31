import assert from "node:assert/strict";
import { test } from "node:test";
import { isOfferWizardV2Enabled } from "./businessFeatures";

const disabled = { features: { newOfferWizard: false } };
const enabled = { features: { newOfferWizard: true } };

test("DEV rollout requires both explicit APP_ENV and opt-in override", () => {
  assert.equal(isOfferWizardV2Enabled(disabled, { APP_ENV: "dev", OFFER_WIZARD_V2_DEV_ENABLED: "true" }), true);
  assert.equal(isOfferWizardV2Enabled(disabled, { APP_ENV: "DEV", OFFER_WIZARD_V2_DEV_ENABLED: "true" }), true);
  assert.equal(isOfferWizardV2Enabled(disabled, { APP_ENV: "dev", OFFER_WIZARD_V2_DEV_ENABLED: "false" }), false);
  assert.equal(isOfferWizardV2Enabled(disabled, { APP_ENV: "production", OFFER_WIZARD_V2_DEV_ENABLED: "true" }), false);
  assert.equal(isOfferWizardV2Enabled(disabled, { APP_ENV: "prod", OFFER_WIZARD_V2_DEV_ENABLED: "true" }), false);
  assert.equal(isOfferWizardV2Enabled(disabled, { APP_ENV: undefined, OFFER_WIZARD_V2_DEV_ENABLED: "true" }), false);
  assert.equal(isOfferWizardV2Enabled(enabled, { APP_ENV: "production", OFFER_WIZARD_V2_DEV_ENABLED: "true" }), true);
});
