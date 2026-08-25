import type {
  AnalyticsVertical,
  Prisma,
  UserEventType,
} from "@prisma/client";
import {
  behaviorCounterDelta,
  getAnalyticsCategoryKey,
} from "@/lib/analytics/metricSemantics";

export type PlanningBuckets = {
  same_day: number;
  weekend: number;
  advance: number;
};

export type BehaviorProfileSnapshot = {
  totalViews: number;
  totalOpens: number;
  totalSaves: number;
  totalPlanAdds: number;
  totalCtaClicks: number;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  weekendShare: number;
  sameDayPlanningShare: number;
  advancePlanningShare: number;
  preferredVerticals: Record<string, number>;
  preferredCategories: Record<string, number>;
  planningBuckets: PlanningBuckets;
};

export type BehaviorProfileEvent = {
  eventType: UserEventType;
  vertical?: AnalyticsVertical | null;
  meta?: Prisma.JsonValue | null;
  createdAt: Date;
};

function asCountMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(v as Record<string, unknown>)) {
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    out[key] = value;
  }
  return out;
}

export function readPlanningBuckets(v: unknown): PlanningBuckets {
  const p = asCountMap(v);
  return {
    same_day: Math.max(0, p.same_day ?? 0),
    weekend: Math.max(0, p.weekend ?? 0),
    advance: Math.max(0, p.advance ?? 0),
  };
}

export function emptyBehaviorProfileSnapshot(): BehaviorProfileSnapshot {
  return {
    totalViews: 0,
    totalOpens: 0,
    totalSaves: 0,
    totalPlanAdds: 0,
    totalCtaClicks: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    weekendShare: 0,
    sameDayPlanningShare: 0,
    advancePlanningShare: 0,
    preferredVerticals: {},
    preferredCategories: {},
    planningBuckets: { same_day: 0, weekend: 0, advance: 0 },
  };
}

export function snapshotFromStoredProfile(profile: {
  totalViews: number;
  totalOpens: number;
  totalSaves: number;
  totalPlanAdds: number;
  totalCtaClicks: number;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  weekendShare: number;
  sameDayPlanningShare: number;
  advancePlanningShare: number;
  preferredVerticals: unknown;
  preferredCategories: unknown;
  planningBuckets: unknown;
}): BehaviorProfileSnapshot {
  return {
    totalViews: profile.totalViews,
    totalOpens: profile.totalOpens,
    totalSaves: profile.totalSaves,
    totalPlanAdds: profile.totalPlanAdds,
    totalCtaClicks: profile.totalCtaClicks,
    firstSeenAt: profile.firstSeenAt,
    lastSeenAt: profile.lastSeenAt,
    weekendShare: profile.weekendShare,
    sameDayPlanningShare: profile.sameDayPlanningShare,
    advancePlanningShare: profile.advancePlanningShare,
    preferredVerticals: asCountMap(profile.preferredVerticals),
    preferredCategories: asCountMap(profile.preferredCategories),
    planningBuckets: readPlanningBuckets(profile.planningBuckets),
  };
}

function bump(
  source: Record<string, number>,
  key: string,
): Record<string, number> {
  return { ...source, [key]: (source[key] ?? 0) + 1 };
}

function planningBucket(event: BehaviorProfileEvent): keyof PlanningBuckets {
  const meta =
    event.meta && typeof event.meta === "object" && !Array.isArray(event.meta)
      ? (event.meta as Record<string, unknown>)
      : {};
  if (meta.planningTiming === "same_day" || meta.sameDay === true) {
    return "same_day";
  }
  if (meta.planningTiming === "weekend" || event.vertical === "WEEKEND") {
    return "weekend";
  }
  return "advance";
}

function shares(
  buckets: PlanningBuckets,
  totalPlanAdds: number,
): Pick<
  BehaviorProfileSnapshot,
  "weekendShare" | "sameDayPlanningShare" | "advancePlanningShare"
> {
  if (totalPlanAdds <= 0) {
    return {
      weekendShare: 0,
      sameDayPlanningShare: 0,
      advancePlanningShare: 0,
    };
  }
  return {
    weekendShare: buckets.weekend / totalPlanAdds,
    sameDayPlanningShare: buckets.same_day / totalPlanAdds,
    advancePlanningShare: buckets.advance / totalPlanAdds,
  };
}

function isMeaningfulPreferenceSignal(delta: ReturnType<typeof behaviorCounterDelta>) {
  return (
    delta.views +
      delta.opens +
      delta.saves +
      delta.planAdds +
      delta.cta >
    0
  );
}

/**
 * Deterministic reducer shared by live aggregation and historical rebuilds.
 *
 * Counters are behavioral history (positive actions), not current domain state:
 * UNSAVE / PLAN_REMOVE do not decrement these lifetime interaction counters.
 * Current saved/planned state remains authoritative in domain tables.
 */
export function reduceBehaviorProfileEvent(
  current: BehaviorProfileSnapshot,
  event: BehaviorProfileEvent,
): BehaviorProfileSnapshot {
  const delta = behaviorCounterDelta(event.eventType, event.meta);
  const meaningful = isMeaningfulPreferenceSignal(delta);

  let preferredVerticals = current.preferredVerticals;
  if (meaningful && event.vertical) {
    preferredVerticals = bump(preferredVerticals, event.vertical);
  }

  let preferredCategories = current.preferredCategories;
  const categoryKey = meaningful ? getAnalyticsCategoryKey(event.meta) : null;
  if (categoryKey) {
    preferredCategories = bump(preferredCategories, categoryKey);
  }

  let planningBuckets = current.planningBuckets;
  if (delta.planAdds > 0) {
    const bucket = planningBucket(event);
    planningBuckets = {
      ...planningBuckets,
      [bucket]: planningBuckets[bucket] + delta.planAdds,
    };
  }

  const totalPlanAdds = current.totalPlanAdds + delta.planAdds;
  const planningShares = shares(planningBuckets, totalPlanAdds);
  const createdAt = event.createdAt;

  return {
    totalViews: current.totalViews + delta.views,
    totalOpens: current.totalOpens + delta.opens,
    totalSaves: current.totalSaves + delta.saves,
    totalPlanAdds,
    totalCtaClicks: current.totalCtaClicks + delta.cta,
    firstSeenAt:
      current.firstSeenAt == null || createdAt < current.firstSeenAt
        ? createdAt
        : current.firstSeenAt,
    lastSeenAt:
      current.lastSeenAt == null || createdAt > current.lastSeenAt
        ? createdAt
        : current.lastSeenAt,
    ...planningShares,
    preferredVerticals,
    preferredCategories,
    planningBuckets,
  };
}

export function reduceBehaviorProfileEvents(
  events: BehaviorProfileEvent[],
): BehaviorProfileSnapshot {
  return events.reduce(
    (snapshot, event) => reduceBehaviorProfileEvent(snapshot, event),
    emptyBehaviorProfileSnapshot(),
  );
}
