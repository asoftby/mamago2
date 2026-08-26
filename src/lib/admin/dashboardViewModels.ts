/**
 * Pure view-model derivation for the /admin dashboard's product blocks
 * (Product Pulse, Engagement, Search & Discovery, Operational Load, and —
 * added for the dashboard rework — North Star, Habit, Funnel, Growth,
 * Supply, B2B, Data Quality).
 *
 * Deliberately takes the ALREADY-fetched `OperationsView.kpis`/`queues`
 * (materialized once per page load by the single `getOperationsView()`
 * call) rather than querying anything itself — no second data source, no
 * request-time MetricSample aggregation. When the snapshot is stale,
 * `kpis`/`queues` are already `{}` upstream, so every derived value here
 * naturally comes out `null` ("Нет данных"), never a fabricated zero.
 */
import { comparisonPercent } from "@/lib/performance/performanceMetrics";

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Percentage-point delta between two 0..1 ratios, rounded to 1 decimal. `null` unless both are known. */
function ratioDeltaPp(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 1000) / 10;
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

/** planning.wpf is mechanically distinct accounts (ACCOUNT_AS_FAMILY_PROXY) — see planningActivity.ts / Metric Dictionary. */
export interface NorthStarViewModel {
  wpf: number | null;
  wpfWoWPercent: number | null;
  /** null unless both wpf and wau are known AND wau > 0. */
  planningPenetration: number | null;
}

export function deriveNorthStar(kpis: Record<string, unknown>): NorthStarViewModel {
  const wpf = readNumber(kpis["planning.wpf"]);
  const wpfPrev = readNumber(kpis["planning.wpf_prev"]);
  const wau = readNumber(kpis["audience.wau"]);
  return {
    wpf,
    wpfWoWPercent: wpf !== null && wpfPrev !== null ? comparisonPercent(wpf, wpfPrev) : null,
    planningPenetration: wpf !== null && wau !== null && wau > 0 ? wpf / wau : null,
  };
}

/** W1/W4 are registration-cohort retention (NOT "any time since signup") — see retention.ts. Deltas are percentage points, not relative %. */
export interface HabitViewModel {
  w1: number | null;
  w1DeltaPp: number | null;
  w4: number | null;
  w4DeltaPp: number | null;
  /** Denominator is "activated planning families" (first qualifying action before the window), not all registrations — see habit.ts. */
  habit3of4: number | null;
  /** 7-day-shifted comparison, not 28-day — see habit.ts. */
  habit3of4DeltaPp: number | null;
}

export function deriveHabit(kpis: Record<string, unknown>): HabitViewModel {
  const w1 = readNumber(kpis["retention.w1"]);
  const w1Prev = readNumber(kpis["retention.w1_prev"]);
  const w4 = readNumber(kpis["retention.w4"]);
  const w4Prev = readNumber(kpis["retention.w4_prev"]);
  const habit3of4 = readNumber(kpis["habit.3of4week"]);
  const habit3of4Prev = readNumber(kpis["habit.3of4week_prev"]);
  return {
    w1,
    w1DeltaPp: ratioDeltaPp(w1, w1Prev),
    w4,
    w4DeltaPp: ratioDeltaPp(w4, w4Prev),
    habit3of4,
    habit3of4DeltaPp: ratioDeltaPp(habit3of4, habit3of4Prev),
  };
}

/** Rates are ordered intersections from engagedUsers (action at/after first DETAIL_OPEN) — see engagementFunnel.ts. Independent of each other, not a forced sequence. */
export interface EngagementFunnelViewModel {
  engagedUsers: number | null;
  saveRate: number | null;
  planRate: number | null;
  ctaRate: number | null;
}

export function deriveEngagementFunnel(kpis: Record<string, unknown>): EngagementFunnelViewModel {
  return {
    engagedUsers: readNumber(kpis["funnel.engaged_users"]),
    saveRate: readNumber(kpis["funnel.save_rate"]),
    planRate: readNumber(kpis["funnel.plan_rate"]),
    ctaRate: readNumber(kpis["funnel.cta_rate"]),
  };
}

/** Organic/Direct growth are intentionally absent — no first-party acquisition-source tracking exists yet (see backlog). */
export interface GrowthViewModel {
  mauGrowthPercent: number | null;
  wauGrowthPercent: number | null;
  wpfGrowthPercent: number | null;
}

export function deriveGrowth(kpis: Record<string, unknown>): GrowthViewModel {
  const mau = readNumber(kpis["audience.mau"]);
  const mauPrev = readNumber(kpis["audience.mau_prev"]);
  const wau = readNumber(kpis["audience.wau"]);
  const wauPrev = readNumber(kpis["audience.wau_prev"]);
  const wpf = readNumber(kpis["planning.wpf"]);
  const wpfPrev = readNumber(kpis["planning.wpf_prev"]);
  return {
    mauGrowthPercent: mau !== null && mauPrev !== null ? comparisonPercent(mau, mauPrev) : null,
    wauGrowthPercent: wau !== null && wauPrev !== null ? comparisonPercent(wau, wauPrev) : null,
    wpfGrowthPercent: wpf !== null && wpfPrev !== null ? comparisonPercent(wpf, wpfPrev) : null,
  };
}

export interface SupplyHealthViewModel {
  activeEvents: number | null;
  activePlaces: number | null;
  activeOffers: number | null;
  /** PROVISIONAL by design — `updatedAt` is a technical modification proxy, not a content-accuracy guarantee. See Metric Dictionary. */
  contentFreshnessPct: number | null;
}

export function deriveSupplyHealth(kpis: Record<string, unknown>): SupplyHealthViewModel {
  return {
    activeEvents: readNumber(kpis["supply.active_events"]),
    activePlaces: readNumber(kpis["supply.active_places"]),
    activeOffers: readNumber(kpis["supply.active_offers"]),
    contentFreshnessPct: readNumber(kpis["supply.content_freshness_pct"]),
  };
}

export interface B2BHealthViewModel {
  activeBusinesses: number | null;
  newBusinesses30d: number | null;
  meaningfulActionRate: number | null;
  /** Explicitly null with a stated reason, never a fabricated 0 — paid Promotion is disabled in prod. See backlog. */
  repeatPromotionRate: null;
  /** Explicitly null — no reliable revenue source/definition yet. See backlog. */
  revenue: null;
}

export function deriveB2BHealth(kpis: Record<string, unknown>): B2BHealthViewModel {
  return {
    activeBusinesses: readNumber(kpis["b2b.active_businesses"]),
    newBusinesses30d: readNumber(kpis["b2b.new_businesses_30d"]),
    meaningfulActionRate: readNumber(kpis["b2b.meaningful_action_rate"]),
    repeatPromotionRate: null,
    revenue: null,
  };
}

export interface DiscoveryQualityViewModel extends SearchDiscoveryViewModel {
  searchActionRate: number | null;
}

export function deriveDiscoveryQuality(kpis: Record<string, unknown>): DiscoveryQualityViewModel {
  return {
    ...deriveSearchDiscovery(kpis),
    searchActionRate: readNumber(kpis["search.action_rate"]),
  };
}

/**
 * Data Quality block. GA4/Yandex are NOT_CONFIGURED (no server-side pull
 * exists yet — see backlog); overallHealthPercent is scoped strictly to
 * what's actually checkable today (internal snapshot freshness), never a
 * fabricated aggregate that implies external reconciliation is done.
 */
export interface DataQualityViewModel {
  internalEventsOk: boolean;
  ga4Status: "NOT_CONFIGURED";
  yandexStatus: "NOT_CONFIGURED";
  identityReconciliation: "NOT_APPLICABLE";
  /** null when the snapshot itself is stale — an honest health % requires a fresh snapshot to grade. */
  overallHealthPercent: number | null;
}

export function deriveDataQuality(stale: boolean): DataQualityViewModel {
  return {
    internalEventsOk: !stale,
    ga4Status: "NOT_CONFIGURED",
    yandexStatus: "NOT_CONFIGURED",
    identityReconciliation: "NOT_APPLICABLE",
    overallHealthPercent: stale ? null : 100,
  };
}
