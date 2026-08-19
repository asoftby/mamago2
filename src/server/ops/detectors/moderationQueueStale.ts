/**
 * Detector #6: moderation_queue_stale (§21 Step 4, Phase E).
 *
 * Real queues only — audited from the actual unified admin moderation
 * inbox (`src/app/admin/moderation/queue/page.tsx`, "Единый inbox: места,
 * изменения, события и предложения"), not invented:
 *
 *   place          -> Place.status = 'PENDING',          age = createdAt
 *   place_revision -> PlaceRevision.status = 'PENDING',   age = submittedAt
 *   event          -> Activity.type='EVENT' status='PENDING', age = createdAt
 *   offer          -> Offer.status = 'PENDING',           age = createdAt
 *
 * `submittedAt` is nullable in the schema but is always set atomically
 * with `status: "PENDING"` in the only code path that transitions a
 * PlaceRevision into PENDING (submitPlaceRevisionForModeration) — the
 * query still defensively requires it non-null rather than guessing a
 * timestamp for any row that violates that invariant.
 *
 * Admin review-queue surfaces (place-reviews/complaints) are a separate,
 * differently-shaped domain — not part of this "queue" concept — and are
 * intentionally out of scope here.
 *
 * No NodeRegistry node in v1 (same reasoning as import_source_failed).
 * Uses indexed MIN aggregates only — never pulls pending rows into
 * Node memory to find the oldest one.
 */
import type { PrismaClient } from "@prisma/client";

import { getDbNow } from "../dbTime";
import type { Detector, DetectorContext, DetectorResult, SignalDraft } from "../types";

export const MODERATION_STALE_THRESHOLD_HOURS = 48;
const STALE_THRESHOLD_MS = MODERATION_STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
const QUEUE_DETAILS_URL = "/admin/moderation/queue";

export function moderationQueueStaleFingerprint(queueKey: string): string {
  return `moderation.queue_stale:${queueKey}`;
}

interface QueueDefinition {
  key: string;
  label: string;
}

const QUEUE_DEFINITIONS: readonly QueueDefinition[] = [
  { key: "place", label: "Places" },
  { key: "place_revision", label: "Place revisions" },
  { key: "event", label: "Events" },
  { key: "offer", label: "Offers" },
];

export interface QueueOldestAge {
  key: string;
  label: string;
  oldestPendingAt: Date | null;
}

export interface ModerationQueueStaleProbe {
  now: Date;
  queues: QueueOldestAge[];
}

export async function probeModerationQueueStale(ctx: DetectorContext): Promise<ModerationQueueStaleProbe> {
  const now = await getDbNow(ctx.prisma);
  const prisma: PrismaClient = ctx.prisma;

  const [place, placeRevision, event, offer] = await Promise.all([
    prisma.place.aggregate({ where: { status: "PENDING" }, _min: { createdAt: true } }),
    prisma.placeRevision.aggregate({
      where: { status: "PENDING", submittedAt: { not: null } },
      _min: { submittedAt: true },
    }),
    prisma.activity.aggregate({
      where: { type: "EVENT", status: "PENDING" },
      _min: { createdAt: true },
    }),
    prisma.offer.aggregate({ where: { status: "PENDING" }, _min: { createdAt: true } }),
  ]);

  return {
    now,
    queues: [
      { key: "place", label: "Places", oldestPendingAt: place._min.createdAt },
      { key: "place_revision", label: "Place revisions", oldestPendingAt: placeRevision._min.submittedAt },
      { key: "event", label: "Events", oldestPendingAt: event._min.createdAt },
      { key: "offer", label: "Offers", oldestPendingAt: offer._min.createdAt },
    ],
  };
}

export function evaluateModerationQueueStale(probe: ModerationQueueStaleProbe): DetectorResult {
  const signals: SignalDraft[] = [];

  for (const queue of probe.queues) {
    if (!queue.oldestPendingAt) continue; // empty queue -> no signal

    const ageMs = probe.now.getTime() - queue.oldestPendingAt.getTime();
    if (ageMs <= STALE_THRESHOLD_MS) continue; // strictly greater than 48h

    signals.push({
      fingerprint: moderationQueueStaleFingerprint(queue.key),
      type: "MODERATION_QUEUE_STALE",
      severity: "WARNING",
      title: `${queue.label} moderation queue has a stale item`,
      summary: `Oldest pending item has been waiting since ${queue.oldestPendingAt.toISOString()} (> ${MODERATION_STALE_THRESHOLD_HOURS}h)`,
      entityType: "moderation_queue",
      entityId: queue.key,
      detailsUrl: QUEUE_DETAILS_URL,
    });
  }

  return { samples: [], signals };
}

export const moderationQueueStaleDetector: Detector<ModerationQueueStaleProbe> = {
  name: "moderation_queue_stale",
  intervalSec: 300,
  timeoutMs: 10_000,
  nodes: [],
  probe: probeModerationQueueStale,
  evaluate: evaluateModerationQueueStale,
};

export { QUEUE_DEFINITIONS };
