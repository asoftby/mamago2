import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchUserSegmentContext,
  resolveSegments,
} from "@/server/services/analytics/SegmentResolverService";
import {
  reduceBehaviorProfileEvents,
  type BehaviorProfileSnapshot,
} from "@/server/services/analytics/behaviorProfileReducer";

const PROFILE_FIELDS = [
  "totalViews",
  "totalOpens",
  "totalSaves",
  "totalPlanAdds",
  "totalCtaClicks",
  "firstSeenAt",
  "lastSeenAt",
  "weekendShare",
  "sameDayPlanningShare",
  "advancePlanningShare",
  "preferredVerticals",
  "preferredCategories",
  "planningBuckets",
  "segmentKeys",
] as const;

export type BehaviorProfileRebuildField = (typeof PROFILE_FIELDS)[number];

export type BehaviorProfileRebuildResult = {
  userId: string;
  eventCount: number;
  existingProfile: boolean;
  changed: boolean;
  changedFields: BehaviorProfileRebuildField[];
  applied: boolean;
  skippedReason: "no_events" | null;
};

type StoredComparable = {
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
  segmentKeys: string[];
};

type ExpectedProfile = StoredComparable & {
  preferredVerticals: Record<string, number>;
  preferredCategories: Record<string, number>;
  planningBuckets: Record<string, number>;
};

type RebuildEventRow = {
  eventType: Parameters<typeof reduceBehaviorProfileEvents>[0][number]["eventType"];
  vertical: Parameters<typeof reduceBehaviorProfileEvents>[0][number]["vertical"];
  meta: Parameters<typeof reduceBehaviorProfileEvents>[0][number]["meta"];
  createdAt: Date;
};

function stableObject(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableObject);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, stableObject(child)]),
  );
}

function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= 1e-12;
  }
  if (a instanceof Date || b instanceof Date) {
    const ai = a instanceof Date ? a.toISOString() : a;
    const bi = b instanceof Date ? b.toISOString() : b;
    return ai === bi;
  }
  return JSON.stringify(stableObject(a)) === JSON.stringify(stableObject(b));
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

function expectedFromSnapshot(
  snapshot: BehaviorProfileSnapshot,
  segmentKeys: string[],
): ExpectedProfile {
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
    preferredVerticals: snapshot.preferredVerticals,
    preferredCategories: snapshot.preferredCategories,
    planningBuckets: snapshot.planningBuckets,
    segmentKeys: [...segmentKeys].sort(),
  };
}

function changedFields(
  existing: StoredComparable | null,
  expected: ExpectedProfile,
): BehaviorProfileRebuildField[] {
  if (!existing) return [...PROFILE_FIELDS];
  return PROFILE_FIELDS.filter((field) => {
    const before =
      field === "segmentKeys"
        ? [...existing.segmentKeys].sort()
        : existing[field];
    return !sameValue(before, expected[field]);
  });
}

async function loadEventsForUser(
  client: Pick<Prisma.TransactionClient, "userEvent">,
  userId: string,
): Promise<RebuildEventRow[]> {
  return client.userEvent.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      eventType: true,
      vertical: true,
      meta: true,
      createdAt: true,
    },
  });
}

function toWriteData(expected: ExpectedProfile) {
  return {
    totalViews: expected.totalViews,
    totalOpens: expected.totalOpens,
    totalSaves: expected.totalSaves,
    totalPlanAdds: expected.totalPlanAdds,
    totalCtaClicks: expected.totalCtaClicks,
    firstSeenAt: expected.firstSeenAt,
    lastSeenAt: expected.lastSeenAt,
    weekendShare: expected.weekendShare,
    sameDayPlanningShare: expected.sameDayPlanningShare,
    advancePlanningShare: expected.advancePlanningShare,
    preferredVerticals: expected.preferredVerticals as Prisma.InputJsonValue,
    preferredCategories: expected.preferredCategories as Prisma.InputJsonValue,
    planningBuckets: expected.planningBuckets as Prisma.InputJsonValue,
    segmentKeys: expected.segmentKeys,
  };
}

async function buildExpected(
  userId: string,
  events: RebuildEventRow[],
): Promise<ExpectedProfile> {
  const snapshot = reduceBehaviorProfileEvents(events);
  const context = await fetchUserSegmentContext(userId);
  const segments = resolveSegments(snapshotForSegments(snapshot), context);
  return expectedFromSnapshot(snapshot, segments);
}

/**
 * Rebuild one derived behavior profile from immutable UserEvent history.
 *
 * Dry-run is the default. Applying requires `maintenanceModeConfirmed=true`
 * because UserEvent insertion currently happens before the per-user profile
 * advisory lock. Running an APPLY while traffic is writing events can race a
 * just-inserted event whose live profile aggregation is waiting on the lock.
 * The CLI therefore requires an explicit maintenance confirmation.
 */
export async function rebuildBehaviorProfileForUser(params: {
  userId: string;
  apply?: boolean;
  maintenanceModeConfirmed?: boolean;
}): Promise<BehaviorProfileRebuildResult> {
  const apply = params.apply === true;
  if (apply && params.maintenanceModeConfirmed !== true) {
    throw new Error(
      "Refusing behavior-profile APPLY without maintenanceModeConfirmed=true",
    );
  }

  if (!apply) {
    const [events, existing] = await Promise.all([
      loadEventsForUser(prisma, params.userId),
      prisma.userBehaviorProfile.findUnique({ where: { userId: params.userId } }),
    ]);
    if (events.length === 0) {
      return {
        userId: params.userId,
        eventCount: 0,
        existingProfile: Boolean(existing),
        changed: false,
        changedFields: [],
        applied: false,
        skippedReason: "no_events",
      };
    }
    const expected = await buildExpected(params.userId, events);
    const fields = changedFields(existing, expected);
    return {
      userId: params.userId,
      eventCount: events.length,
      existingProfile: Boolean(existing),
      changed: fields.length > 0,
      changedFields: fields,
      applied: false,
      skippedReason: null,
    };
  }

  // Segment context is current account state and safe to resolve outside the
  // profile transaction. Event/profile reads and writes stay under one lock.
  const context = await fetchUserSegmentContext(params.userId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<unknown[]>`
      SELECT pg_advisory_xact_lock(hashtext(${`behavior-profile:${params.userId}`})::bigint)
    `;

    const [events, existing] = await Promise.all([
      loadEventsForUser(tx, params.userId),
      tx.userBehaviorProfile.findUnique({ where: { userId: params.userId } }),
    ]);

    if (events.length === 0) {
      return {
        userId: params.userId,
        eventCount: 0,
        existingProfile: Boolean(existing),
        changed: false,
        changedFields: [],
        applied: false,
        skippedReason: "no_events" as const,
      };
    }

    const snapshot = reduceBehaviorProfileEvents(events);
    const expected = expectedFromSnapshot(
      snapshot,
      resolveSegments(snapshotForSegments(snapshot), context),
    );
    const fields = changedFields(existing, expected);

    if (fields.length > 0) {
      const writeData = toWriteData(expected);
      await tx.userBehaviorProfile.upsert({
        where: { userId: params.userId },
        create: { userId: params.userId, ...writeData },
        update: writeData,
      });
    }

    return {
      userId: params.userId,
      eventCount: events.length,
      existingProfile: Boolean(existing),
      changed: fields.length > 0,
      changedFields: fields,
      applied: fields.length > 0,
      skippedReason: null,
    };
  });
}

export async function listUsersWithBehaviorEvents(params: {
  take: number;
  afterUserId?: string | null;
}): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      userEvents: { some: {} },
      ...(params.afterUserId ? { id: { gt: params.afterUserId } } : {}),
    },
    orderBy: { id: "asc" },
    take: params.take,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
