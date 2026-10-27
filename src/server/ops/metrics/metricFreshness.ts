/**
 * Sample freshness policy (ТЗ «Аналитика админки», C2).
 *
 * A MetricSample older than 3 × the owning collector's `intervalSec` is
 * considered stale: the projection returns `null` ("Нет данных") instead of
 * showing the last value forever after a collector was switched off or keeps
 * failing. The 3× factor mirrors `detectorFreshness.ts` (a detector is stale
 * after three missed intervals).
 *
 * `METRIC_OWNERS` maps a metric key (exact name, or a prefix ending in ".")
 * to the collector that writes it; the longest match wins. The interval is
 * read from the collector object itself, so changing a collector's cadence
 * changes its TTL automatically. `metricFreshness.test.ts` asserts that every
 * projected KPI has an owner.
 */
import { audienceDauCollector } from "./collectors/audienceDaily";
import { audienceWeeklyMonthlyCollector } from "./collectors/audienceWeeklyMonthly";
import { b2bHealthCollector } from "./collectors/b2bHealth";
import { b2bQueueMetricsCollector } from "./collectors/b2bQueue";
import { commsMetricsCollector } from "./collectors/comms";
import { engagementFunnelCollector } from "./collectors/engagementFunnel";
import { funnelMetricsCollector } from "./collectors/funnel";
import { googleSearchConsoleCollector } from "./collectors/googleSearchConsole";
import { habitCollector } from "./collectors/habit";
import { importMetricsCollector } from "./collectors/importMetrics";
import { ingestionQualityCollector } from "./collectors/ingestionQuality";
import { moderationQueueMetricsCollector } from "./collectors/moderationQueues";
import { retentionCollector } from "./collectors/retention";
import { searchMetricsCollector } from "./collectors/search";
import { seoEvergreenWeeklyCollector } from "./collectors/seoEvergreenWeekly";
import { supplyHealthCollector } from "./collectors/supplyHealth";
import { telemetryEventsCollector } from "./collectors/telemetry";
import { weeklyPlanningFamiliesCollector } from "./collectors/weeklyPlanningFamilies";
import type { MetricCollector } from "./types";

/** Number of collector intervals after which a sample is no longer shown. */
export const SAMPLE_TTL_INTERVALS = 3;

/** `db.*` are written by the `db_degraded` detector (60 s cadence), not by a collector. */
const DB_DETECTOR_INTERVAL_SEC = 60;

const METRIC_OWNERS: ReadonlyArray<readonly [string, MetricCollector | number]> = [
  ["audience.dau", audienceDauCollector],
  ["audience.", audienceWeeklyMonthlyCollector],
  ["search.", searchMetricsCollector],
  ["funnel.engaged_users", engagementFunnelCollector],
  ["funnel.save_rate", engagementFunnelCollector],
  ["funnel.plan_rate", engagementFunnelCollector],
  ["funnel.cta_rate", engagementFunnelCollector],
  ["funnel.", funnelMetricsCollector],
  ["telemetry.events_written_5m", telemetryEventsCollector],
  ["telemetry.", ingestionQualityCollector],
  ["planning.", weeklyPlanningFamiliesCollector],
  ["retention.", retentionCollector],
  ["habit.", habitCollector],
  ["supply.", supplyHealthCollector],
  ["b2b.", b2bHealthCollector],
  ["queue.moderation.", moderationQueueMetricsCollector],
  ["queue.import.", importMetricsCollector],
  ["import.", importMetricsCollector],
  ["queue.b2b.", b2bQueueMetricsCollector],
  ["comms.", commsMetricsCollector],
  ["gsc.", googleSearchConsoleCollector],
  ["seo.", seoEvergreenWeeklyCollector],
  ["db.", DB_DETECTOR_INTERVAL_SEC],
];

/** Collector cadence (seconds) that owns `metric`, or null when no owner is known. */
export function metricIntervalSec(metric: string): number | null {
  let best: { length: number; interval: number } | null = null;
  for (const [key, owner] of METRIC_OWNERS) {
    const matches = key.endsWith(".") ? metric.startsWith(key) : metric === key;
    if (!matches || (best && best.length >= key.length)) continue;
    best = { length: key.length, interval: typeof owner === "number" ? owner : owner.intervalSec };
  }
  return best ? best.interval : null;
}

/**
 * Stricter per-metric limits (ms) than 3 x interval. The ingestion-quality
 * shares are shown on the Data Quality block, where a 45-minute-old ratio
 * would hide a broken ingestion: they expire after 20 minutes (owner decision
 * on PR 1).
 */
const TTL_OVERRIDE_MS: Readonly<Record<string, number>> = {
  "telemetry.bot_rejected_share_24h": 20 * 60 * 1000,
  "telemetry.bot_rejected_share_7d": 20 * 60 * 1000,
  "telemetry.no_identity_rejected_share_24h": 20 * 60 * 1000,
  "telemetry.stored_without_identity_share_24h": 20 * 60 * 1000,
};

/** Max age (ms) a sample may have to still be shown; null = no known owner, never expire. */
export function metricTtlMs(metric: string): number | null {
  const interval = metricIntervalSec(metric);
  if (interval === null) return TTL_OVERRIDE_MS[metric] ?? null;
  const generic = SAMPLE_TTL_INTERVALS * interval * 1000;
  const override = TTL_OVERRIDE_MS[metric];
  return override === undefined ? generic : Math.min(generic, override);
}

/** True when a sample collected at `collectedAt` is older than the metric's TTL at `now`. */
export function isSampleStale(metric: string, collectedAt: Date, now: Date): boolean {
  const ttl = metricTtlMs(metric);
  return ttl !== null && now.getTime() - collectedAt.getTime() > ttl;
}
