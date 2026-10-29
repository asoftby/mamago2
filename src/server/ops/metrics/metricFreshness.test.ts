/**
 * Sample TTL policy (C2) — no DB required.
 * Run: npx tsx src/server/ops/metrics/metricFreshness.test.ts
 */
import assert from "node:assert/strict";

import { KPI_METRIC_NAMES } from "../snapshot/metricProjection";
import { isSampleStale, metricIntervalSec, metricTtlMs } from "./metricFreshness";

// Every projected KPI has a known owner, so none can silently show an immortal sample.
for (const metric of KPI_METRIC_NAMES) {
  assert.notEqual(metricIntervalSec(metric), null, `${metric} must map to a collector (metricFreshness.ts)`);
}
for (const metric of [
  "queue.moderation.size",
  "queue.moderation.oldest_age_sec",
  "queue.import.review_size",
  "import.failed_sources",
  "queue.b2b.pending_size",
  "gsc.page.rise.1",
  "gsc.page.fall.3",
]) {
  assert.notEqual(metricIntervalSec(metric), null, `${metric} must map to a collector`);
}

// Intervals come from the collectors themselves; the most specific owner wins.
assert.equal(metricIntervalSec("audience.dau"), 900);
assert.equal(metricIntervalSec("audience.wau"), 3_600);
assert.equal(metricIntervalSec("audience.wau_completed_prev"), 3_600);
assert.equal(metricIntervalSec("funnel.saves"), 900);
assert.equal(metricIntervalSec("funnel.save_rate"), 3_600);
assert.equal(metricIntervalSec("telemetry.events_written_5m"), 300);
assert.equal(metricIntervalSec("telemetry.bot_rejected_share_24h"), 900);
assert.equal(metricIntervalSec("retention.w1"), 86_400);
assert.equal(metricIntervalSec("unknown.metric"), null);

// TTL = 3 x interval, boundary inclusive of exactly 3 intervals.
assert.equal(metricTtlMs("audience.dau"), 3 * 900 * 1000);
const now = new Date("2026-10-27T12:00:00.000Z");
assert.equal(isSampleStale("audience.dau", new Date(now.getTime() - 3 * 900 * 1000), now), false, "exactly 3 intervals is still fresh");
assert.equal(isSampleStale("audience.dau", new Date(now.getTime() - 3 * 900 * 1000 - 1), now), true);
assert.equal(isSampleStale("retention.w1", new Date(now.getTime() - 2 * 86_400_000), now), false, "daily collector tolerates 2 days");
// Data Quality shares expire after 20 minutes (stricter than 3 x 15 min).
assert.equal(metricTtlMs("telemetry.bot_rejected_share_24h"), 20 * 60 * 1000);
assert.equal(isSampleStale("telemetry.no_identity_rejected_share_24h", new Date(now.getTime() - 21 * 60 * 1000), now), true);
assert.equal(isSampleStale("telemetry.no_identity_rejected_share_24h", new Date(now.getTime() - 19 * 60 * 1000), now), false);
assert.equal(isSampleStale("unknown.metric", new Date(0), now), false, "no owner -> never expires");

console.log("metricFreshness.test.ts: OK");
