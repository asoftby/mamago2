/**
 * MetricCollector registration (§21 Step 5, Phase B). Registers exactly
 * nine collectors — explicit entries, no reflection/file-system discovery:
 *
 *   audience_dau (15min), audience_wau_mau (60min)         — Phase C
 *   search_metrics (15min)                                  — Phase D
 *   funnel_metrics (15min)                                  — Phase E
 *   telemetry_events (5min)                                 — Phase F
 *   moderation_queue_metrics (5min)                         — Phase G
 *   import_metrics (5min)                                   — Phase H
 *   b2b_queue_metrics (5min)                                — Phase I
 *   comms_metrics (5min)                                    — Phase J
 *
 * db.latency_ms / db.connection_capacity_pct are NOT collectors — they
 * remain owned exclusively by the db_degraded detector (Step 3), written
 * via DetectorResult.samples / persistDetectorResult. This registry is
 * architecturally separate from DetectorRegistry: collectors never
 * produce DetectorRun rows or OperationalSignal rows.
 */
import { registerMetricCollector } from "../metricCollectorRegistry";
import { audienceDauCollector } from "./audienceDaily";
import { audienceWeeklyMonthlyCollector } from "./audienceWeeklyMonthly";
import { b2bQueueMetricsCollector } from "./b2bQueue";
import { commsMetricsCollector } from "./comms";
import { funnelMetricsCollector } from "./funnel";
import { importMetricsCollector } from "./importMetrics";
import { moderationQueueMetricsCollector } from "./moderationQueues";
import { searchMetricsCollector } from "./search";
import { telemetryEventsCollector } from "./telemetry";

export function registerCoreMetricCollectors(): void {
  registerMetricCollector(audienceDauCollector);
  registerMetricCollector(audienceWeeklyMonthlyCollector);
  registerMetricCollector(searchMetricsCollector);
  registerMetricCollector(funnelMetricsCollector);
  registerMetricCollector(telemetryEventsCollector);
  registerMetricCollector(moderationQueueMetricsCollector);
  registerMetricCollector(importMetricsCollector);
  registerMetricCollector(b2bQueueMetricsCollector);
  registerMetricCollector(commsMetricsCollector);
}
