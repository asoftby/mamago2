import * as assert from "node:assert/strict";

import {
  isEventCtaStepFeatureEnabled,
  resolveEventPricingParticipationCtaRenderMode,
} from "./ctaStepFeatureFlag";

assert.equal(isEventCtaStepFeatureEnabled({ NODE_ENV: "development" }), false);
assert.equal(isEventCtaStepFeatureEnabled({ NODE_ENV: "test" }), false);
assert.equal(isEventCtaStepFeatureEnabled({ NODE_ENV: "production" }), false);

assert.equal(
  isEventCtaStepFeatureEnabled({
    NODE_ENV: "production",
    NEXT_PUBLIC_ENABLE_EVENT_CTA_STEP: "true",
  }),
  true,
);

assert.equal(
  isEventCtaStepFeatureEnabled({
    NODE_ENV: "development",
    NEXT_PUBLIC_ENABLE_EVENT_CTA_STEP: "false",
  }),
  false,
);

assert.equal(resolveEventPricingParticipationCtaRenderMode(false), "legacy");
assert.equal(resolveEventPricingParticipationCtaRenderMode(true), "shared");

console.log("event step5 pricing CTA flag tests: OK");
