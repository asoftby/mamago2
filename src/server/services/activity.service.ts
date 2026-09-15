import { prisma } from "@/lib/prisma";
import type { Activity, ActivitySession, ActivityType, ScheduleMode, User } from "@prisma/client";
import { ContentStatus } from "@prisma/client";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { detachImportedRecordsForCatalogEntity } from "@/server/modules/import/services/import-link-reconciliation.service";
import { assertContentLifecycleOperationAllowed } from "@/server/services/contentLifecycleOperation.service";

export type CreateActivityInput = {
  title: string;
  shortDesc: string;
  description?: string;
  cityId: string;
  coverImageUrl?: string;
  priceFrom?: number;
  currency?: string;
  ageLabel?: string;
  businessId?: string;
  createdBy: string;
  sessions?: Date[]; // Array of session start times
  type: ActivityType;
  scheduleMode: ScheduleMode;
};

export type UpdateActivityInput = {
  title?: string;
  shortDesc?: string;
  description?: string;
  cityId?: string;
  coverImageUrl?: string;
  priceFrom?: number;
  currency?: string;
  ageLabel?: string;
  sessions?: Date[]; // Replaces all existing sessions
};

export type ActivityWithSessions = Activity & {
  sessions: ActivitySession[];
};

/**
 * Create a new activity
 */
export async function createActivity(
  input: CreateActivityInput
): Promise<ActivityWithSessions> {
  const { sessions, createdBy, ...activityData } = input;

  const activity = await prisma.activity.create({
    data: {
      ...activityData,
      ownerUserId: createdBy,
      sessions: sessions
        ? {
            create: sessions.map((startsAt) => ({ startsAt })),
          }
        : undefined,
    },
    include: {
      sessions: {
        orderBy: { startsAt: "asc" },
      },
    },
  });

  return activity as ActivityWithSessions;
}

/**
 * Update an existing activity
 */
export async function updateActivity(
  activityId: string,
  input: UpdateActivityInput
): Promise<ActivityWithSessions> {
  const { sessions, ...activityData } = input;

  // Sessions with a non-null `source` come from an import pipeline (ABWS
  // today), not from this route's own flat `sessions: Date[]` model — that
  // model has no way to represent `source`/`externalId`/`buyUrl`/price, so
  // replacing sessions here would silently discard them. Same fix as
  // PR #298 (src/app/api/business/events/[id]/route.ts's
  // hasImportedSessions), applied here because this older route was never
  // covered by that fix (BACKLOG-153) — once any imported session exists,
  // this route must not touch sessions at all.
  //
  // The read above and the delete below are not atomic — a concurrent ABWS
  // upsert landing an imported session between them is possible (same race
  // found by automated review on PR #303's shared-function equivalent of
  // this guard). Rather than requiring a serializable transaction, the
  // delete itself is scoped to source: null so it can never remove an
  // imported row regardless of timing.
  let applySessionsUpdate = sessions !== undefined;
  if (applySessionsUpdate) {
    const existingSessions = await prisma.activitySession.findMany({
      where: { activityId },
      select: { source: true },
    });
    const hasImportedSessions = existingSessions.some((s) => s.source != null);
    if (hasImportedSessions) {
      applySessionsUpdate = false;
    }
  }

  if (applySessionsUpdate) {
    // Delete existing sessions — scoped to source: null, see comment above.
    await prisma.activitySession.deleteMany({
      where: { activityId, source: null },
    });
  }

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      ...activityData,
      sessions:
        applySessionsUpdate
          ? {
              create: (sessions as Date[]).map((startsAt) => ({ startsAt })),
            }
          : undefined,
    },
    include: {
      sessions: {
        orderBy: { startsAt: "asc" },
      },
    },
  });

  return activity as ActivityWithSessions;
}

/**
 * Get activity by ID with sessions
 */
export async function getActivityById(
  activityId: string
): Promise<ActivityWithSessions | null> {
  return await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      sessions: {
        orderBy: { startsAt: "asc" },
      },
    },
  }) as ActivityWithSessions | null;
}

/**
 * List activities for a business
 */
export async function listBusinessActivities(
  businessId: string
): Promise<ActivityWithSessions[]> {
  return await prisma.activity.findMany({
    where: { businessId },
    include: {
      sessions: {
        orderBy: { startsAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  }) as ActivityWithSessions[];
}

/**
 * Delete an activity
 */
export async function deleteActivity(
  activityId: string,
  actorRole: string,
): Promise<void> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true },
  });

  if (!activity) {
    return;
  }

  const deleteOperation =
    activity.status === ContentStatus.ARCHIVED ? "deleteArchived" : "deleteDraft";

  await assertContentLifecycleOperationAllowed({
    contentType: "ACTIVITY",
    contentId: activityId,
    operation: deleteOperation,
    status: activity.status,
    actorRole,
    prisma,
  });

  await detachImportedRecordsForCatalogEntity(
    {
      entityType: "ACTIVITY",
      entityId: activityId,
      reason: "Связанное событие было удалено и больше не считается активной сущностью каталога.",
    },
    prisma,
  );
  await prisma.activity.delete({
    where: { id: activityId },
  });
}

/**
 * Check if user can manage activity (business-first; legacy ownerUserId fallback).
 */
export async function canManageActivity(
  user: Pick<User, "id" | "role">,
  activityId: string
): Promise<boolean> {
  return canManageActivityById(user, activityId);
}
