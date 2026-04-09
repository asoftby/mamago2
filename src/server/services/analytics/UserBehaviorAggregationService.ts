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

const BEHAVIOR_PROFILE_LOG = "[behavior-profile]";

export type BehaviorAggregationInput = {
  userId: string;
  eventType: UserEventType;
  entityType?: AnalyticsEntityType | null;
  vertical?: AnalyticsVertical | null;
  meta?: Prisma.JsonValue | null;
};

type VerticalCounts = Record<string, number>;
type CategoryCounts = Record<string, number>;
type PlanningBuckets = { same_day: number; weekend: number; advance: number };

function asRecord(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(n)) continue;
    out[k] = n;
  }
  return out;
}

function bump(map: Record<string, number>, key: string): Record<string, number> {
  return { ...map, [key]: (map[key] ?? 0) + 1 };
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
  const m =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {};
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
      return { views: 0, opens: 0, saves: 0, planAdds: 0, cta: 0 };
  }
}

/**
 * Агрегированный профиль поведения: счётчики, lastSeen, доли по PLAN_ADD, сегменты.
 */
export async function applyUserBehaviorEvent(
  input: BehaviorAggregationInput,
): Promise<void> {
  const { userId, eventType, entityType, vertical, meta } = input;
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

    const existing = await prisma.userBehaviorProfile.findUnique({
      where: { userId },
    });

    const verticalKey = vertical ?? "_none";
    const categoryKey = entityType ?? "_none";

    let preferredVerticals: VerticalCounts = asRecord(existing?.preferredVerticals);
    let preferredCategories: CategoryCounts = asRecord(existing?.preferredCategories);
    if (vertical) preferredVerticals = bump(preferredVerticals, verticalKey);
    if (entityType) preferredCategories = bump(preferredCategories, categoryKey);

    let planningBuckets = readPlanningBuckets(existing?.planningBuckets);
    const nextTotalPlanAdds = (existing?.totalPlanAdds ?? 0) + d.planAdds;

    if (eventType === "PLAN_ADD") {
      const b = planBucket(meta, vertical);
      planningBuckets = {
        ...planningBuckets,
        [b]: (planningBuckets[b] ?? 0) + 1,
      };
    }

    const shares = computePlanningShares(planningBuckets, nextTotalPlanAdds);

    const nextTotalViews = (existing?.totalViews ?? 0) + d.views;
    const nextTotalOpens = (existing?.totalOpens ?? 0) + d.opens;
    const nextTotalSaves = (existing?.totalSaves ?? 0) + d.saves;
    const nextTotalCta = (existing?.totalCtaClicks ?? 0) + d.cta;
    const nextFirst = existing?.firstSeenAt ?? now;
    const nextWeekend =
      eventType === "PLAN_ADD"
        ? shares.weekend
        : (existing?.weekendShare ?? 0);
    const nextSameDay =
      eventType === "PLAN_ADD"
        ? shares.sameDay
        : (existing?.sameDayPlanningShare ?? 0);
    const nextAdvance =
      eventType === "PLAN_ADD"
        ? shares.advance
        : (existing?.advancePlanningShare ?? 0);

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

    const preferredVJson =
      Object.keys(preferredVerticals).length > 0
        ? (preferredVerticals as Prisma.InputJsonValue)
        : undefined;
    const preferredCJson =
      Object.keys(preferredCategories).length > 0
        ? (preferredCategories as Prisma.InputJsonValue)
        : undefined;

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
      planningBuckets: planningPayload,
      segmentKeys,
    };

    if (eventType === "PLAN_ADD") {
      updateData.weekendShare = shares.weekend;
      updateData.sameDayPlanningShare = shares.sameDay;
      updateData.advancePlanningShare = shares.advance;
    }

    /** Атомарный upsert устраняет гонку INSERT при параллельных событиях (unique userId). */
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
  } catch (e) {
    console.error(`${BEHAVIOR_PROFILE_LOG} aggregation:error`, {
      userId,
      eventType,
    }, e);
  }
}

export const UserBehaviorAggregationService = {
  applyUserBehaviorEvent,
};
