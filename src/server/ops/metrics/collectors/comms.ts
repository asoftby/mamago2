/**
 * comms.failed_deliveries_1h — every 5 min (§21 Step 5, Phase J).
 *
 * `NotificationDelivery.status = 'FAILED'` — channel-agnostic (IN_APP/
 * EMAIL/TELEGRAM), the general-purpose delivery log with an existing
 * admin page and a purpose-built `[status, createdAt]` index. Trailing
 * 60 minutes, per the metric's own name — independent of the 5-minute
 * collection cadence.
 *
 * No alert threshold, no WARNING/CRITICAL classification — this is
 * evidence collection only, for a future email_pipeline_stalled rule to
 * be designed from later. No provider_error/recipient_error split is
 * invented; `FAILED` is the one canonical failure status that exists.
 */
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const COMMS_LOOKBACK_SEC = 3_600;

export async function collectCommsMetrics(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const windowStart = new Date(ctx.now.getTime() - COMMS_LOOKBACK_SEC * 1000);

  const failedDeliveries = await ctx.prisma.notificationDelivery.count({
    where: { status: "FAILED", createdAt: { gte: windowStart, lt: ctx.now } },
  });

  return [{ metric: "comms.failed_deliveries_1h", value: failedDeliveries }];
}

export const commsMetricsCollector: MetricCollector = {
  name: "comms_metrics",
  intervalSec: 300,
  timeoutMs: 10_000,
  collect: collectCommsMetrics,
};
