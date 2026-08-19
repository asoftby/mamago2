/**
 * MetricSample -> snapshot projection (§21 Step 5, Phase N).
 *
 * O(1)-style point lookups only — one indexed `findFirst` per
 * (metric, dimKey) pair via the `[metric, dimKey, collectedAt DESC]`
 * index, never an aggregation. This runs ONLY inside the async worker's
 * snapshot builder (collectSnapshotPayload); /api/admin/ops itself must
 * never query MetricSample directly (INV-03).
 *
 * A missing sample projects to `null`, never 0 — a collector that hasn't
 * run yet (or whose last run failed) must not be indistinguishable from a
 * genuinely observed zero.
 *
 * Node colors are never touched here — MetricSample values are current-
 * value KPIs/queue gauges only, driven by nothing but the latest sample.
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
  "audience.mau",
  "search.queries_total",
  "search.zero_result_rate",
  "funnel.content_opens",
  "funnel.saves",
  "funnel.plan_adds",
  "funnel.cta_clicks",
  "telemetry.events_written_5m",
] as const;

export async function projectOperationsKpis(prisma: PrismaClient): Promise<Record<string, number | null>> {
  const entries = await Promise.all(
    KPI_METRIC_NAMES.map(async (metric) => [metric, await latestMetricValue(prisma, metric)] as const),
  );
  return Object.fromEntries(entries);
}
