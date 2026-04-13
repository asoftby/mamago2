import assert from "node:assert/strict";
import {
  mapUserEventToPromotionAction,
  buildPromotionLaunchHref,
} from "./shared.ts";

assert.equal(
  buildPromotionLaunchHref({
    publicationType: "EVENT",
    publicationId: "evt_1",
  }),
  "/business/promotion?publicationType=EVENT&publicationId=evt_1",
);

assert.equal(
  mapUserEventToPromotionAction({
    eventType: "PLAN_ADD",
    meta: { targetAction: "plan" },
  }),
  "SAVE_TO_PLAN",
);

assert.equal(
  mapUserEventToPromotionAction({
    eventType: "CTA_CLICK",
    meta: { targetAction: "buy" },
  }),
  "SEND_LEAD",
);

assert.equal(
  mapUserEventToPromotionAction({
    eventType: "CTA_CLICK",
    meta: { targetAction: "plan" },
  }),
  null,
);

console.log("promotion.shared.test.ts passed");
