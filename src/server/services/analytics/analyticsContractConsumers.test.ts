/**
 * Source-inspection guard for Analytics Contract v1 consumers.
 * Keeps high-value dashboards/profile pipelines on one canonical definition.
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

  const liveProfile = source(
    "src/server/services/analytics/UserBehaviorAggregationService.ts",
  );
  const eventService = source(
    "src/server/services/analytics/AnalyticsEventService.ts",
  );
  const rebuild = source(
    "src/server/services/analytics/behaviorProfileRebuild.service.ts",
  );
  const rebuildCli = source(
    "scripts/analytics/rebuild-user-behavior-profiles.ts",
  );
  const segmentResolver = source(
    "src/server/services/analytics/SegmentResolverService.ts",
  );

  assert.ok(
    liveProfile.includes("reduceBehaviorProfileEvent") &&
      rebuild.includes("reduceBehaviorProfileEvents"),
    "live aggregation and historical rebuild must share the same pure reducer",
  );
  assert.ok(
    eventService.includes("await applyUserBehaviorEvent") &&
      !eventService.includes("void applyUserBehaviorEvent"),
    "authenticated telemetry must await the derived profile update",
  );
  assert.ok(
    liveProfile.includes("pg_advisory_xact_lock") &&
      rebuild.includes("pg_advisory_xact_lock"),
    "live/rebuild profile writes must serialize per user",
  );
  assert.ok(
    rebuildCli.includes('process.argv.includes("--apply")') &&
      rebuildCli.includes('process.argv.includes("--maintenance-confirm")'),
    "rebuild CLI must remain dry-run by default and explicitly guard writes",
  );
  assert.ok(
    !segmentResolver.includes('topKey(cats) === "OFFER"'),
    "PRICE_SENSITIVE must not be inferred from OFFER entity type",
  );

  console.log("analyticsContractConsumers.test.ts: OK");
}

main();
