/**
 * telemetry.events_written_5m — every 5 min (§21 Step 5, Phase F).
 *
 * Historical evidence for future telemetry_pipeline_stale work — NOT that
 * canary itself, and no synthetic event sender is implemented here.
 *
 * `UserEvent` is the app's own canonical telemetry-ingestion path (labeled
 * `[product-telemetry]` at its write site,
 * src/server/services/analytics/AnalyticsEventService.ts) — there is no
 * separate generic telemetry table. Every row's existence already proves
 * a successful persisted write, so counting rows created in the trailing
 * 5 minutes directly answers "how many events were successfully
 * persisted" — a genuine zero is a real, valid observation.
 */
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const TELEMETRY_WINDOW_SEC = 300;

export async function collectTelemetryEventsWritten(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const windowStart = new Date(ctx.now.getTime() - TELEMETRY_WINDOW_SEC * 1000);

  const count = await ctx.prisma.userEvent.count({
    where: { createdAt: { gte: windowStart, lt: ctx.now } },
  });

  return [{ metric: "telemetry.events_written_5m", value: count }];
}

export const telemetryEventsCollector: MetricCollector = {
  name: "telemetry_events",
  intervalSec: TELEMETRY_WINDOW_SEC,
  timeoutMs: 10_000,
  collect: collectTelemetryEventsWritten,
};
