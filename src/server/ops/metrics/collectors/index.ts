/**
 * MetricCollector registration (§21 Step 5, Phase B). Registers explicit
 * entries, no reflection/file-system discovery:
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
 * Added for the /admin dashboard rework (North Star + habit + funnel):
 *   weekly_planning_families (60min), retention (24h), habit (24h),
 *   engagement_funnel (60min), supply_health (30min), b2b_health (60min)
 *
 * External SEO health (read-only, fail-closed):
 *   google_search_console (6h)
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
import { b2bHealthCollector } from "./b2bHealth";
import { b2bQueueMetricsCollector } from "./b2bQueue";
import { commsMetricsCollector } from "./comms";
import { engagementFunnelCollector } from "./engagementFunnel";
import { funnelMetricsCollector } from "./funnel";
import { googleSearchConsoleCollector } from "./googleSearchConsole";
import { habitCollector } from "./habit";
import { importMetricsCollector } from "./importMetrics";
import { moderationQueueMetricsCollector } from "./moderationQueues";
import { retentionCollector } from "./retention";
import { searchMetricsCollector } from "./search";
import { supplyHealthCollector } from "./supplyHealth";
import { telemetryEventsCollector } from "./telemetry";
import { weeklyPlanningFamiliesCollector } from "./weeklyPlanningFamilies";

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
  registerMetricCollector(weeklyPlanningFamiliesCollector);
  registerMetricCollector(retentionCollector);
  registerMetricCollector(habitCollector);
  registerMetricCollector(engagementFunnelCollector);
  registerMetricCollector(supplyHealthCollector);
  registerMetricCollector(b2bHealthCollector);
  registerMetricCollector(googleSearchConsoleCollector);
}
