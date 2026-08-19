/**
 * Pure view-model derivation for the /admin dashboard's product blocks
 * (Product Pulse, Engagement, Search & Discovery, Operational Load).
 *
 * Deliberately takes the ALREADY-fetched `OperationsView.kpis`/`queues`
 * (materialized once per page load by the single `getOperationsView()`
 * call) rather than querying anything itself — no second data source, no
 * request-time MetricSample aggregation. When the snapshot is stale,
 * `kpis`/`queues` are already `{}` upstream, so every derived value here
 * naturally comes out `null` ("Нет данных"), never a fabricated zero.
 */

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface ProductPulseViewModel {
  dau: number | null;
  wau: number | null;
  mau: number | null;
  /** null unless both wau and mau are known AND mau > 0 — never divide by an unknown/zero denominator. */
  wauMauRatio: number | null;
}

export function deriveProductPulse(kpis: Record<string, unknown>): ProductPulseViewModel {
  const dau = readNumber(kpis["audience.dau"]);
  const wau = readNumber(kpis["audience.wau"]);
  const mau = readNumber(kpis["audience.mau"]);
  const wauMauRatio = wau !== null && mau !== null && mau > 0 ? wau / mau : null;
  return { dau, wau, mau, wauMauRatio };
}

export interface EngagementViewModel {
  contentOpens: number | null;
  saves: number | null;
  planAdds: number | null;
  ctaClicks: number | null;
}

export function deriveEngagement(kpis: Record<string, unknown>): EngagementViewModel {
  return {
    contentOpens: readNumber(kpis["funnel.content_opens"]),
    saves: readNumber(kpis["funnel.saves"]),
    planAdds: readNumber(kpis["funnel.plan_adds"]),
    ctaClicks: readNumber(kpis["funnel.cta_clicks"]),
  };
}

/** null when either side is unknown, or the denominator is 0 (not mathematically defined). */
export function deriveStageConversion(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from === 0) return null;
  return to / from;
}

export interface SearchDiscoveryViewModel {
  queriesTotal: number | null;
  /**
   * null (unknown/absent) whenever queriesTotal is null or 0 — a rate is
   * not mathematically defined without queries, and a real 0% (queries
   * exist, none had zero results) must stay visually distinct from that.
   */
  zeroResultRate: number | null;
}

export function deriveSearchDiscovery(kpis: Record<string, unknown>): SearchDiscoveryViewModel {
  const queriesTotal = readNumber(kpis["search.queries_total"]);
  const rawRate = readNumber(kpis["search.zero_result_rate"]);
  const zeroResultRate = queriesTotal === null || queriesTotal === 0 ? null : rawRate;
  return { queriesTotal, zeroResultRate };
}

export interface WorkloadViewModel {
  moderation: {
    place: number | null;
    place_revision: number | null;
    event: number | null;
    offer: number | null;
    /** Sum of the 4 dimensions — null (not 0) unless every dimension is a known number, so a partially-collected cycle never silently under-reports the backlog. */
    total: number | null;
  };
  importReviewSize: number | null;
  b2bPendingSize: number | null;
  commsFailedDeliveries1h: number | null;
}

interface ModerationQueueLike {
  size: number | null;
}

interface QueuesLike {
  moderation?: {
    place?: ModerationQueueLike;
    place_revision?: ModerationQueueLike;
    event?: ModerationQueueLike;
    offer?: ModerationQueueLike;
  };
  import?: { reviewSize?: number | null };
  b2b?: { pendingSize?: number | null };
}

export function deriveWorkload(queues: Record<string, unknown>, kpis: Record<string, unknown>): WorkloadViewModel {
  const q = queues as QueuesLike;
  const place = readNumber(q.moderation?.place?.size);
  const placeRevision = readNumber(q.moderation?.place_revision?.size);
  const event = readNumber(q.moderation?.event?.size);
  const offer = readNumber(q.moderation?.offer?.size);
  const allKnown = place !== null && placeRevision !== null && event !== null && offer !== null;

  return {
    moderation: {
      place,
      place_revision: placeRevision,
      event,
      offer,
      total: allKnown ? place + placeRevision + event + offer : null,
    },
    importReviewSize: readNumber(q.import?.reviewSize),
    b2bPendingSize: readNumber(q.b2b?.pendingSize),
    commsFailedDeliveries1h: readNumber(kpis["comms.failed_deliveries_1h"]),
  };
}
