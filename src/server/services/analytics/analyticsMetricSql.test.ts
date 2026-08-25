/**
 * Pure regression tests for the server-side Analytics Contract v1 SQL layer.
 * No database is required.
 *
 * Run: pnpm exec tsx src/server/services/analytics/analyticsMetricSql.test.ts
 */
import assert from "node:assert/strict";
import {
  ARTICLE_NON_CONTENT_CARD_IMPRESSION_KEYS,
  ARTICLE_NON_CTA_EVENT_KEYS,
} from "@/lib/analytics/metricSemantics";
import {
  CANONICAL_CARD_IMPRESSION_SQL,
  CANONICAL_CTA_CLICK_SQL,
  canonicalMetricRowToCounts,
} from "./analyticsMetricSql";

function valuesOf(sql: { values: unknown[] }): unknown[] {
  return sql.values;
}

function main() {
  const ctaValues = valuesOf(CANONICAL_CTA_CLICK_SQL);
  for (const key of ARTICLE_NON_CTA_EVENT_KEYS) {
    assert.ok(
      ctaValues.includes(key),
      `canonical CTA SQL must exclude shared semantic key: ${key}`,
    );
  }

  const impressionValues = valuesOf(CANONICAL_CARD_IMPRESSION_SQL);
  for (const key of ARTICLE_NON_CONTENT_CARD_IMPRESSION_KEYS) {
    assert.ok(
      impressionValues.includes(key),
      `canonical impression SQL must exclude shared semantic key: ${key}`,
    );
  }

  assert.deepEqual(
    canonicalMetricRowToCounts({
      impressions: BigInt(2),
      opens: BigInt(3),
      saves: BigInt(4),
      plan_adds: BigInt(5),
      cta_clicks: BigInt(6),
    }),
    { impressions: 2, opens: 3, saves: 4, planAdds: 5, ctaClicks: 6 },
  );

  assert.deepEqual(canonicalMetricRowToCounts(undefined), {
    impressions: 0,
    opens: 0,
    saves: 0,
    planAdds: 0,
    ctaClicks: 0,
  });

  console.log("analyticsMetricSql.test.ts: OK");
}

main();
