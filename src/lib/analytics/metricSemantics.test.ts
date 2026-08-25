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
  isNonContentCardImpression,
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
    isNonContentCardImpression({ articleEvent: "article_telegram_cta_impression" }),
    true,
  );
  assert.equal(
    behaviorCounterDelta("CARD_VIEW", {
      articleEvent: "article_telegram_cta_impression",
    }).views,
    0,
    "an impression of the Telegram CTA block is not a content-card impression",
  );
  assert.equal(
    isCardImpression("CARD_VIEW", {
      articleEvent: "article_telegram_cta_impression",
    }),
    false,
  );

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
    behaviorCounterDelta("CTA_CLICK", { articleEvent: "article_rating_submitted" }).cta,
    0,
    "article rating is a product interaction, not a conversion CTA",
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
