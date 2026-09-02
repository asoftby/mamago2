/**
 * MetricSample -> snapshot projection (§21 Step 5, Phase N).
 *
 * The admin read path never scans MetricSample. Projection runs only in the
 * async worker that materializes OperationsSnapshot.
 *
 * A missing sample projects to `null`, never 0 — a collector that hasn't
 * run yet (or whose last run failed) must not be indistinguishable from a
 * genuinely observed zero.
 */
import type { PrismaClient } from "@prisma/client";

async function latestMetricValue(prisma: PrismaClient, metric: string, dimKey = ""): Promise<number | null> {
  const row = await prisma.metricSample.findFirst({
    where: { metric, dimKey },
    orderBy: { collectedAt: "desc" },
    select: { value: true },
  });
  return row ? row.value : null;
}

async function latestMetricSample(
  prisma: PrismaClient,
  metric: string,
): Promise<{ dimKey: string; value: number } | null> {
  const row = await prisma.metricSample.findFirst({
    where: { metric },
    orderBy: { collectedAt: "desc" },
    select: { dimKey: true, value: true },
  });
  return row ?? null;
}

export interface ModerationQueueProjection {
  size: number | null;
  oldestAgeSec: number | null;
}

export interface OperationsQueuesProjection {
  moderation: {
    place: ModerationQueueProjection;
    place_revision: ModerationQueueProjection;
    event: ModerationQueueProjection;
    offer: ModerationQueueProjection;
  };
  import: {
    reviewSize: number | null;
    failedSources: number | null;
  };
  b2b: {
    pendingSize: number | null;
  };
}

const MODERATION_QUEUE_KEYS = ["place", "place_revision", "event", "offer"] as const;

async function projectModerationQueues(prisma: PrismaClient): Promise<OperationsQueuesProjection["moderation"]> {
  const entries = await Promise.all(
    MODERATION_QUEUE_KEYS.map(async (key) => {
      const [size, oldestAgeSec] = await Promise.all([
        latestMetricValue(prisma, "queue.moderation.size", key),
        latestMetricValue(prisma, "queue.moderation.oldest_age_sec", key),
      ]);
      return [key, { size, oldestAgeSec }] as const;
    }),
  );
  return Object.fromEntries(entries) as OperationsQueuesProjection["moderation"];
}

export async function projectOperationsQueues(prisma: PrismaClient): Promise<OperationsQueuesProjection> {
  const [moderation, reviewSize, failedSources, pendingSize] = await Promise.all([
    projectModerationQueues(prisma),
    latestMetricValue(prisma, "queue.import.review_size"),
    latestMetricValue(prisma, "import.failed_sources"),
    latestMetricValue(prisma, "queue.b2b.pending_size"),
  ]);

  return {
    moderation,
    import: { reviewSize, failedSources },
    b2b: { pendingSize },
  };
}

/** Global-dimKey (dimKey="") KPI metric names projected onto the snapshot's `kpis` field. */
const KPI_METRIC_NAMES = [
  "db.latency_ms",
  "db.connection_capacity_pct",
  "comms.failed_deliveries_1h",
  "audience.dau",
  "audience.wau",
  "audience.wau_prev",
  "audience.mau",
  "audience.mau_prev",
  "search.queries_total",
  "search.zero_result_rate",
  "search.action_rate",
  "funnel.content_opens",
  "funnel.saves",
  "funnel.plan_adds",
  "funnel.cta_clicks",
  "telemetry.events_written_5m",
  "planning.wpf",
  "planning.wpf_prev",
  "retention.w1",
  "retention.w1_prev",
  "retention.w4",
  "retention.w4_prev",
  "habit.3of4week",
  "habit.3of4week_prev",
  "funnel.engaged_users",
  "funnel.save_rate",
  "funnel.plan_rate",
  "funnel.cta_rate",
  "supply.active_events",
  "supply.active_places",
  "supply.active_offers",
  "supply.content_freshness_pct",
  "b2b.active_businesses",
  "b2b.new_businesses_30d",
  "b2b.meaningful_action_rate",
  // Google Search Console MVP — two complete 7-day windows.
  "gsc.clicks_7d",
  "gsc.clicks_prev_7d",
  "gsc.impressions_7d",
  "gsc.impressions_prev_7d",
  "gsc.ctr_7d",
  "gsc.ctr_prev_7d",
  "gsc.position_7d",
  "gsc.position_prev_7d",
] as const;

export interface GscPageMoverProjection {
  page: string;
  deltaClicks: number;
}

async function projectGscPageMovers(prisma: PrismaClient): Promise<{
  rising: GscPageMoverProjection[];
  falling: GscPageMoverProjection[];
}> {
  const [rise1, rise2, rise3, fall1, fall2, fall3] = await Promise.all([
    latestMetricSample(prisma, "gsc.page.rise.1"),
    latestMetricSample(prisma, "gsc.page.rise.2"),
    latestMetricSample(prisma, "gsc.page.rise.3"),
    latestMetricSample(prisma, "gsc.page.fall.1"),
    latestMetricSample(prisma, "gsc.page.fall.2"),
    latestMetricSample(prisma, "gsc.page.fall.3"),
  ]);
  const toMover = (row: { dimKey: string; value: number } | null): GscPageMoverProjection | null =>
    row && row.dimKey ? { page: row.dimKey, deltaClicks: row.value } : null;
  return {
    rising: [rise1, rise2, rise3].map(toMover).filter((row): row is GscPageMoverProjection => row !== null),
    falling: [fall1, fall2, fall3].map(toMover).filter((row): row is GscPageMoverProjection => row !== null),
  };
}

export async function projectOperationsKpis(prisma: PrismaClient): Promise<Record<string, unknown>> {
  const [entries, pageMovers] = await Promise.all([
    Promise.all(KPI_METRIC_NAMES.map(async (metric) => [metric, await latestMetricValue(prisma, metric)] as const)),
    projectGscPageMovers(prisma),
  ]);
  return {
    ...Object.fromEntries(entries),
    "gsc.page_movers": pageMovers,
  };
}
