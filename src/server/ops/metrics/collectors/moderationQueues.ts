/**
 * queue.moderation.size / queue.moderation.oldest_age_sec — every 5 min
 * (§21 Step 5, Phase G).
 *
 * Reuses EXACTLY the four real queues already audited and used by Step
 * 4's moderation_queue_stale detector — same pending definitions, same
 * age-timestamp fields, no invented queues:
 *
 *   place          -> Place.status='PENDING',              age = createdAt
 *   place_revision -> PlaceRevision.status='PENDING',        age = submittedAt
 *   event          -> Activity type='EVENT' status='PENDING', age = createdAt
 *   offer          -> Offer.status='PENDING',                age = createdAt
 *
 * Indexed COUNT/MIN aggregates only — never a full row scan in Node. An
 * empty queue legitimately writes size=0 and oldest_age_sec=0 (the
 * successful query proved emptiness, so 0 is a real fact, not a
 * synthesized default).
 */
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

interface QueueAggregate {
  key: string;
  count: number;
  oldestPendingAt: Date | null;
}

async function aggregateQueues(ctx: MetricCollectorContext): Promise<QueueAggregate[]> {
  const { prisma } = ctx;

  const [place, placeRevision, event, offer] = await Promise.all([
    prisma.place.aggregate({ where: { status: "PENDING" }, _count: true, _min: { createdAt: true } }),
    prisma.placeRevision.aggregate({
      where: { status: "PENDING", submittedAt: { not: null } },
      _count: true,
      _min: { submittedAt: true },
    }),
    prisma.activity.aggregate({
      where: { type: "EVENT", status: "PENDING" },
      _count: true,
      _min: { createdAt: true },
    }),
    prisma.offer.aggregate({ where: { status: "PENDING" }, _count: true, _min: { createdAt: true } }),
  ]);

  return [
    { key: "place", count: place._count, oldestPendingAt: place._min.createdAt },
    { key: "place_revision", count: placeRevision._count, oldestPendingAt: placeRevision._min.submittedAt },
    { key: "event", count: event._count, oldestPendingAt: event._min.createdAt },
    { key: "offer", count: offer._count, oldestPendingAt: offer._min.createdAt },
  ];
}

export async function collectModerationQueueMetrics(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const queues = await aggregateQueues(ctx);
  const samples: MetricSampleDraft[] = [];

  for (const queue of queues) {
    samples.push({ metric: "queue.moderation.size", dimKey: queue.key, value: queue.count });
    const oldestAgeSec = queue.oldestPendingAt
      ? (ctx.now.getTime() - queue.oldestPendingAt.getTime()) / 1000
      : 0;
    samples.push({ metric: "queue.moderation.oldest_age_sec", dimKey: queue.key, value: oldestAgeSec });
  }

  return samples;
}

export const moderationQueueMetricsCollector: MetricCollector = {
  name: "moderation_queue_metrics",
  intervalSec: 300,
  timeoutMs: 10_000,
  collect: collectModerationQueueMetrics,
};
