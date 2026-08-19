import * as assert from "node:assert/strict";

import {
  isPlaceCtaStepFeatureEnabled,
  resolvePlaceCtaRenderMode,
} from "./ctaStepFeatureFlag";

assert.equal(isPlaceCtaStepFeatureEnabled({ NODE_ENV: "development" }), false);
assert.equal(isPlaceCtaStepFeatureEnabled({ NODE_ENV: "test" }), false);
assert.equal(isPlaceCtaStepFeatureEnabled({ NODE_ENV: "production" }), false);

assert.equal(
  isPlaceCtaStepFeatureEnabled({
    NODE_ENV: "production",
    NEXT_PUBLIC_ENABLE_PLACE_CTA_STEP: "true",
  }),
  true,
);

assert.equal(
  isPlaceCtaStepFeatureEnabled({
    NODE_ENV: "development",
    NEXT_PUBLIC_ENABLE_PLACE_CTA_STEP: "false",
  }),
  false,
);

assert.equal(resolvePlaceCtaRenderMode(false), "legacy");
assert.equal(resolvePlaceCtaRenderMode(true), "shared");

console.log("place cta step feature flag tests: OK");
