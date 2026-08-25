/**
 * Source-inspection guard for Analytics Contract v1 consumers.
 * Keeps high-value dashboards on one canonical metric definition without DB.
 *
 * Run: pnpm exec tsx src/server/services/analytics/analyticsContractConsumers.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function assertUsesSharedContract(path: string) {
  const s = source(path);
  assert.ok(
    s.includes("analyticsMetricSql"),
    `${path} must consume the shared server-side analytics metric contract`,
  );
  return s;
}

function main() {
  const funnels = assertUsesSharedContract(
    "src/server/services/analytics/analyticsFunnels.service.ts",
  );
  const behavior = assertUsesSharedContract(
    "src/server/services/analytics/analyticsBehavior.service.ts",
  );
  const overview = assertUsesSharedContract(
    "src/server/services/analytics/analyticsOverview.service.ts",
  );
  const content = assertUsesSharedContract(
    "src/server/services/analytics/analyticsContentPerformance.service.ts",
  );
  const business = assertUsesSharedContract(
    "src/server/services/business/businessWorkspace.service.ts",
  );

  for (const [name, s] of [
    ["funnels", funnels],
    ["overview", overview],
    ["content performance", content],
    ["business workspace", business],
  ] as const) {
    assert.ok(
      !s.includes('"PAGE_VIEW"'),
      `${name} must not treat PAGE_VIEW as a publication-performance metric`,
    );
  }

  assert.ok(
    business.includes("CANONICAL_CARD_IMPRESSION_SQL") &&
      business.includes("CANONICAL_CTA_CLICK_SQL"),
    "B2B publication metrics must use canonical impression and CTA SQL",
  );
  assert.ok(
    funnels.includes('measurement: "event_volume"'),
    "Funnels API must explicitly identify itself as event-volume analysis",
  );

  const funnelUi = source(
    "src/components/admin/analytics/AdminAnalyticsFunnels.tsx",
  );
  assert.ok(
    funnelUi.includes("not sequential user/session conversion") &&
      funnelUi.includes("Acquisition/session funnels belong to GA4"),
    "Funnels UI must not present event-volume ratios as user conversion",
  );

  assert.ok(
    behavior.includes("CANONICAL_CTA_CLICK_SQL") &&
      behavior.includes("CANONICAL_CARD_IMPRESSION_SQL"),
    "Behavior aggregates must use canonical impression/CTA definitions",
  );

  console.log("analyticsContractConsumers.test.ts: OK");
}

main();
