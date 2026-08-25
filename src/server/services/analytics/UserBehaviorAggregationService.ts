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
import {
  emptyBehaviorProfileSnapshot,
  reduceBehaviorProfileEvent,
  snapshotFromStoredProfile,
  type BehaviorProfileSnapshot,
} from "@/server/services/analytics/behaviorProfileReducer";

const BEHAVIOR_PROFILE_LOG = "[behavior-profile]";

export type BehaviorAggregationInput = {
  userId: string;
  eventType: UserEventType;
  entityType?: AnalyticsEntityType | null;
  vertical?: AnalyticsVertical | null;
  meta?: Prisma.JsonValue | null;
  /** Exact UserEvent.createdAt when available; falls back to now for legacy direct callers. */
  createdAt?: Date;
};

function asJsonInput(map: Record<string, number>): Prisma.InputJsonValue | undefined {
  return Object.keys(map).length > 0
    ? (map as Prisma.InputJsonValue)
    : undefined;
}

function snapshotForSegments(snapshot: BehaviorProfileSnapshot) {
  return {
    totalViews: snapshot.totalViews,
    totalOpens: snapshot.totalOpens,
    totalSaves: snapshot.totalSaves,
    totalPlanAdds: snapshot.totalPlanAdds,
    totalCtaClicks: snapshot.totalCtaClicks,
    firstSeenAt: snapshot.firstSeenAt,
    lastSeenAt: snapshot.lastSeenAt,
    weekendShare: snapshot.weekendShare,
    sameDayPlanningShare: snapshot.sameDayPlanningShare,
    advancePlanningShare: snapshot.advancePlanningShare,
    preferredVerticals: snapshot.preferredVerticals as Prisma.JsonValue,
    preferredCategories: snapshot.preferredCategories as Prisma.JsonValue,
  };
}

/**
 * Incrementally maintains the derived UserBehaviorProfile from UserEvent.
 *
 * Contract v1:
 * - the pure reducer is shared with historical rebuilds;
 * - PAGE_VIEW is traffic, never a content-impression counter/preference signal;
 * - article transport events do not inflate CTA/preference signals;
 * - categories use real taxonomy metadata only;
 * - lifetime SAVE/PLAN_ADD counters represent positive behavioral history;
 * - a per-user PostgreSQL advisory transaction lock prevents read→write races
 *   in JSON maps / planning shares when events arrive concurrently.
 */
export async function applyUserBehaviorEvent(
  input: BehaviorAggregationInput,
): Promise<void> {
  const { userId, eventType, vertical, meta } = input;
  if (!userId) return;

  const verbose = process.env.NODE_ENV !== "production";
  const eventCreatedAt = input.createdAt ?? new Date();

  try {
    if (verbose) {
      console.log(`${BEHAVIOR_PROFILE_LOG} aggregation:start`, {
        userId,
        eventType,
      });
    }

    // Context is account state, not part of the event/profile write lock.
    const ctx = await fetchUserSegmentContext(userId);

    await prisma.$transaction(async (tx) => {
      // Serialize the derived profile read→reduce→write sequence for this user.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`behavior-profile:${userId}`})::bigint)
      `;

      const existing = await tx.userBehaviorProfile.findUnique({
        where: { userId },
      });
      const current = existing
        ? snapshotFromStoredProfile(existing)
        : emptyBehaviorProfileSnapshot();
      const next = reduceBehaviorProfileEvent(current, {
        eventType,
        vertical: vertical ?? null,
        meta: meta ?? null,
        createdAt: eventCreatedAt,
      });
      const segmentKeys = resolveSegments(snapshotForSegments(next), ctx);

      const preferredVerticals = asJsonInput(next.preferredVerticals);
      const preferredCategories = asJsonInput(next.preferredCategories);
      const planningBuckets = next.planningBuckets as Prisma.InputJsonValue;

      const absoluteData = {
        totalViews: next.totalViews,
        totalOpens: next.totalOpens,
        totalSaves: next.totalSaves,
        totalPlanAdds: next.totalPlanAdds,
        totalCtaClicks: next.totalCtaClicks,
        firstSeenAt: next.firstSeenAt,
        lastSeenAt: next.lastSeenAt,
        weekendShare: next.weekendShare,
        sameDayPlanningShare: next.sameDayPlanningShare,
        advancePlanningShare: next.advancePlanningShare,
        preferredVerticals,
        preferredCategories,
        planningBuckets,
        segmentKeys,
      } satisfies Prisma.UserBehaviorProfileUncheckedUpdateInput;

      await tx.userBehaviorProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...absoluteData,
        },
        update: absoluteData,
      });
    });

    if (verbose) {
      console.log(`${BEHAVIOR_PROFILE_LOG} aggregation:done`, {
        userId,
        eventType,
      });
    }
  } catch (e) {
    console.error(
      `${BEHAVIOR_PROFILE_LOG} aggregation:error`,
      { userId, eventType },
      e,
    );
  }
}

export const UserBehaviorAggregationService = {
  applyUserBehaviorEvent,
};
