import * as assert from "node:assert/strict";

import {
  isOfferCtaStepFeatureEnabled,
  resolveOfferPricingCtaRenderMode,
} from "./ctaStepFeatureFlag";

assert.equal(isOfferCtaStepFeatureEnabled({ NODE_ENV: "development" }), true);
assert.equal(isOfferCtaStepFeatureEnabled({ NODE_ENV: "test" }), true);
assert.equal(isOfferCtaStepFeatureEnabled({ NODE_ENV: "production" }), false);
assert.equal(
  isOfferCtaStepFeatureEnabled({
    NODE_ENV: "development",
    NEXT_PUBLIC_ENABLE_OFFER_CTA_STEP: "false",
  }),
  false,
);
assert.equal(
  isOfferCtaStepFeatureEnabled({
    NODE_ENV: "production",
    NEXT_PUBLIC_ENABLE_OFFER_CTA_STEP: "true",
  }),
  true,
);
assert.equal(resolveOfferPricingCtaRenderMode(false), "legacy");
assert.equal(resolveOfferPricingCtaRenderMode(true), "shared");

console.log("offer step5 cta flag tests: OK");
