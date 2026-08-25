/**
 * Analytics Contract v1 semantic tests.
 * Запуск: npx tsx src/lib/analytics/metricSemantics.test.ts
 */
import assert from "node:assert/strict";
import {
  behaviorCounterDelta,
  getAnalyticsCategoryKey,
  isArticleReadingPseudoCta,
  isCanonicalCtaClick,
  isCardImpression,
} from "./metricSemantics";

function main() {
  assert.deepEqual(
    behaviorCounterDelta("PAGE_VIEW"),
    { views: 0, opens: 0, saves: 0, planAdds: 0, cta: 0 },
    "PAGE_VIEW must not inflate product card-impression views",
  );
  assert.equal(behaviorCounterDelta("CARD_VIEW").views, 1);
  assert.equal(isCardImpression("CARD_VIEW"), true);
  assert.equal(isCardImpression("PAGE_VIEW"), false);

  assert.equal(
    isArticleReadingPseudoCta({ articleEvent: "article_read_50" }),
    true,
  );
  assert.equal(
    behaviorCounterDelta("CTA_CLICK", { articleEvent: "article_complete" }).cta,
    0,
    "article reading milestones transported as CTA_CLICK must not increment CTA KPI",
  );
  assert.equal(
    isCanonicalCtaClick("CTA_CLICK", { articleEvent: "article_telegram_cta_click" }),
    true,
    "real article CTA clicks remain CTA clicks",
  );
  assert.equal(behaviorCounterDelta("CTA_CLICK", { targetAction: "buy" }).cta, 1);

  assert.equal(
    getAnalyticsCategoryKey({ categorySlug: "master-klassy" }),
    "master-klassy",
  );
  assert.equal(
    getAnalyticsCategoryKey({ entityType: "EVENT" }),
    null,
    "entity type is not a taxonomy category",
  );

  console.log("metricSemantics.test.ts: OK");
}

main();
