import type {
  AnalyticsEntityType,
  AnalyticsVertical,
  Prisma,
  UserEventType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchUserSegmentContext,
  resolveSegments,
} from "@/server/services/analytics/SegmentResolverService";
import { behaviorAffinityDelta } from "@/server/services/recommendations/behaviorSignalWeights";

const BEHAVIOR_PROFILE_LOG = "[behavior-profile]";

export type BehaviorAggregationInput = {
  userId: string;
  eventType: UserEventType;
  entityType?: AnalyticsEntityType | null;
  entityId?: string | null;
  vertical?: AnalyticsVertical | null;
  meta?: Prisma.JsonValue | null;
};

type NumericMap = Record<string, number>;
type PlanningBuckets = { same_day: number; weekend: number; advance: number };

type SemanticTraits = {
  categoryIds: string[];
  format: string | null;
  signalIds: string[];
};

function asRecord(v: unknown): NumericMap {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: NumericMap = {};
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) continue;
    out[key] = n;
  }
  return out;
}

function metaRecord(meta: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

function bump(map: NumericMap, key: string): NumericMap {
  return { ...map, [key]: (map[key] ?? 0) + 1 };
}

function bumpBy(map: NumericMap, keys: string[], delta: number): NumericMap {
  if (delta === 0 || keys.length === 0) return map;
  const next = { ...map };
  for (const key of keys) {
    next[key] = Math.round(((next[key] ?? 0) + delta) * 100) / 100;
  }
  return next;
}

function readPlanningBuckets(pb: unknown): PlanningBuckets {
  if (!pb || typeof pb !== "object" || Array.isArray(pb)) {
    return { same_day: 0, weekend: 0, advance: 0 };
  }
  const p = pb as Record<string, unknown>;
  return {
    same_day: Math.max(0, Number(p.same_day) || 0),
    weekend: Math.max(0, Number(p.weekend) || 0),
    advance: Math.max(0, Number(p.advance) || 0),
  };
}

/** Доли PLAN_ADD: same-day vs «уикенд» vs заранее (по умолчанию — advance). */
function planBucket(
  meta: Prisma.JsonValue | null | undefined,
  vertical?: AnalyticsVertical | null,
): keyof PlanningBuckets {
  const m = metaRecord(meta);
  if (m.planningTiming === "same_day" || m.sameDay === true) return "same_day";
  if (m.planningTiming === "weekend" || vertical === "WEEKEND") return "weekend";
  return "advance";
}

function computePlanningShares(
  buckets: PlanningBuckets,
  totalPlanAdds: number,
): { weekend: number; sameDay: number; advance: number } {
  if (totalPlanAdds <= 0) {
    return { weekend: 0, sameDay: 0, advance: 0 };
  }
  return {
    sameDay: buckets.same_day / totalPlanAdds,
    weekend: buckets.weekend / totalPlanAdds,
    advance: buckets.advance / totalPlanAdds,
  };
}

function counterDelta(eventType: UserEventType): {
  views: number;
  opens: number;
  saves: number;
  planAdds: number;
  cta: number;
} {
  switch (eventType) {
    case "PAGE_VIEW":
    case "CARD_VIEW":
      return { views: 1, opens: 0, saves: 0, planAdds: 0, cta: 0 };
    case "DETAIL_OPEN":
      return { views: 0, opens: 1, saves: 0, planAdds: 0, cta: 0 };
    case "SAVE":
      return { views: 0, opens: 0, saves: 1, planAdds: 0, cta: 0 };
    case "PLAN_ADD":
      return { views: 0, opens: 0, saves: 0, planAdds: 1, cta: 0 };
    case "CTA_CLICK":
      return { views: 0, opens: 0, saves: 0, planAdds: 0, cta: 1 };
    default:
      // UNSAVE / PLAN_REMOVE are negative learning signals, not negative
      // historical funnel counts. Their effect is captured in affinity maps.
      return { views: 0, opens: 0, saves: 0, planAdds: 0, cta: 0 };
  }
}

const STRONG_ENTITY_SIGNAL_EVENTS = new Set<UserEventType>([
  "DETAIL_OPEN",
  "SAVE",
  "UNSAVE",
  "PLAN_ADD",
  "PLAN_REMOVE",
  "CTA_CLICK",
  "BOOKING_CREATED",
  "BOOKING_CONFIRMED",
  "BOOKING_COMPLETED",
  "BOOKING_CANCELLED",
  "FEEDBACK_LEFT",
]);

/**
 * Resolve stable semantic traits only when they are missing from telemetry and
 * the action is strong enough to justify one DB lookup. CARD_VIEW/PAGE_VIEW do
 * not cause an extra query: high-volume impressions must remain cheap.
 */
async function resolveSemanticTraits(input: BehaviorAggregationInput): Promise<SemanticTraits> {
  const m = metaRecord(input.meta);
  let categoryIds = readStringList(m.categoryIds);
  let signalIds = readStringList(m.signalIds);
  let format = typeof m.format === "string" && m.format.trim() ? m.format.trim() : null;

  const shouldResolveActivity =
    input.entityType === "EVENT" &&
    Boolean(input.entityId) &&
    STRONG_ENTITY_SIGNAL_EVENTS.has(input.eventType) &&
    (categoryIds.length === 0 || !format);

  if (shouldResolveActivity) {
    const activity = await prisma.activity.findUnique({
      where: { id: input.entityId! },
      select: {
        eventCategoryId: true,
        format: true,
      },
    });
    if (categoryIds.length === 0 && activity?.eventCategoryId) {
      categoryIds = [activity.eventCategoryId];
    }
    if (!format && activity?.format) {
      format = String(activity.format);
    }
  }

  // Signals are accepted from normalized telemetry only for now. Resolving
  // taxonomy relations per impression/action would be needless query load and
  // can be added later in one batch projection job if required.
  signalIds = [...new Set(signalIds)];

  return { categoryIds, format, signalIds };
}

/**
 * Aggregated behavior profile. Raw UserEvent stays the source of truth; this is
 * a cheap projection that can be rebuilt when learning weights evolve.
 */
export async function applyUserBehaviorEvent(
  input: BehaviorAggregationInput,
): Promise<void> {
  const { userId, eventType, vertical, meta } = input;
  if (!userId) return;

  const verbose = process.env.NODE_ENV !== "production";

  try {
    if (verbose) {
      console.log(`${BEHAVIOR_PROFILE_LOG} aggregation:start`, {
        userId,
        eventType,
      });
    }

    const d = counterDelta(eventType);
    const now = new Date();
    const [existing, semanticTraits] = await Promise.all([
      prisma.userBehaviorProfile.findUnique({ where: { userId } }),
      resolveSemanticTraits(input),
    ]);

    let preferredVerticals = asRecord(existing?.preferredVerticals);
    let preferredCategories = asRecord(existing?.preferredCategories);
    let preferredFormats = asRecord(existing?.preferredFormats);
    let preferredSignals = asRecord(existing?.preferredSignals);

    if (vertical) preferredVerticals = bump(preferredVerticals, vertical);

    const affinityDelta = behaviorAffinityDelta(eventType, metaRecord(meta));
    preferredCategories = bumpBy(
      preferredCategories,
      semanticTraits.categoryIds,
      affinityDelta,
    );
    preferredFormats = bumpBy(
      preferredFormats,
      semanticTraits.format ? [semanticTraits.format] : [],
      affinityDelta,
    );
    preferredSignals = bumpBy(
      preferredSignals,
      semanticTraits.signalIds,
      affinityDelta,
    );

    let planningBuckets = readPlanningBuckets(existing?.planningBuckets);
    const nextTotalPlanAdds = (existing?.totalPlanAdds ?? 0) + d.planAdds;

    if (eventType === "PLAN_ADD") {
      const bucket = planBucket(meta, vertical);
      planningBuckets = {
        ...planningBuckets,
        [bucket]: (planningBuckets[bucket] ?? 0) + 1,
      };
    }

    const shares = computePlanningShares(planningBuckets, nextTotalPlanAdds);

    const nextTotalViews = (existing?.totalViews ?? 0) + d.views;
    const nextTotalOpens = (existing?.totalOpens ?? 0) + d.opens;
    const nextTotalSaves = (existing?.totalSaves ?? 0) + d.saves;
    const nextTotalCta = (existing?.totalCtaClicks ?? 0) + d.cta;
    const nextFirst = existing?.firstSeenAt ?? now;
    const nextWeekend =
      eventType === "PLAN_ADD" ? shares.weekend : (existing?.weekendShare ?? 0);
    const nextSameDay =
      eventType === "PLAN_ADD" ? shares.sameDay : (existing?.sameDayPlanningShare ?? 0);
    const nextAdvance =
      eventType === "PLAN_ADD" ? shares.advance : (existing?.advancePlanningShare ?? 0);

    const ctx = await fetchUserSegmentContext(userId);
    const segmentKeys = resolveSegments(
      {
        totalViews: nextTotalViews,
        totalOpens: nextTotalOpens,
        totalSaves: nextTotalSaves,
        totalPlanAdds: nextTotalPlanAdds,
        totalCtaClicks: nextTotalCta,
        firstSeenAt: nextFirst,
        lastSeenAt: now,
        weekendShare: nextWeekend,
        sameDayPlanningShare: nextSameDay,
        advancePlanningShare: nextAdvance,
        preferredVerticals: preferredVerticals as Prisma.JsonValue,
        preferredCategories: preferredCategories as Prisma.JsonValue,
      },
      ctx,
    );

    const jsonOrUndefined = (map: NumericMap): Prisma.InputJsonValue | undefined =>
      Object.keys(map).length > 0 ? (map as Prisma.InputJsonValue) : undefined;

    const preferredVJson = jsonOrUndefined(preferredVerticals);
    const preferredCJson = jsonOrUndefined(preferredCategories);
    const preferredFJson = jsonOrUndefined(preferredFormats);
    const preferredSJson = jsonOrUndefined(preferredSignals);
    const planningPayload = {
      same_day: planningBuckets.same_day,
      weekend: planningBuckets.weekend,
      advance: planningBuckets.advance,
    } as Prisma.InputJsonValue;

    const updateData: Prisma.UserBehaviorProfileUpdateInput = {
      totalViews: { increment: d.views },
      totalOpens: { increment: d.opens },
      totalSaves: { increment: d.saves },
      totalPlanAdds: { increment: d.planAdds },
      totalCtaClicks: { increment: d.cta },
      lastSeenAt: now,
      preferredVerticals: preferredVJson,
      preferredCategories: preferredCJson,
      preferredFormats: preferredFJson,
      preferredSignals: preferredSJson,
      planningBuckets: planningPayload,
      segmentKeys,
    };

    if (eventType === "PLAN_ADD") {
      updateData.weekendShare = shares.weekend;
      updateData.sameDayPlanningShare = shares.sameDay;
      updateData.advancePlanningShare = shares.advance;
    }

    await prisma.userBehaviorProfile.upsert({
      where: { userId },
      create: {
        userId,
        totalViews: d.views,
        totalOpens: d.opens,
        totalSaves: d.saves,
        totalPlanAdds: d.planAdds,
        totalCtaClicks: d.cta,
        firstSeenAt: now,
        lastSeenAt: now,
        weekendShare: eventType === "PLAN_ADD" ? shares.weekend : 0,
        sameDayPlanningShare: eventType === "PLAN_ADD" ? shares.sameDay : 0,
        advancePlanningShare: eventType === "PLAN_ADD" ? shares.advance : 0,
        preferredVerticals: preferredVJson,
        preferredCategories: preferredCJson,
        preferredFormats: preferredFJson,
        preferredSignals: preferredSJson,
        planningBuckets: planningPayload,
        segmentKeys,
      },
      update: updateData,
    });

    if (verbose) {
      console.log(`${BEHAVIOR_PROFILE_LOG} aggregation:done`, {
        userId,
        eventType,
      });
    }
  } catch (error) {
    console.error(`${BEHAVIOR_PROFILE_LOG} aggregation:error`, {
      userId,
      eventType,
    }, error);
  }
}

export const UserBehaviorAggregationService = {
  applyUserBehaviorEvent,
};
