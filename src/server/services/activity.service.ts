import { prisma } from "@/lib/prisma";
import type { Activity, ActivitySession, ActivityType, ScheduleMode, User } from "@prisma/client";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { detachImportedRecordsForCatalogEntity } from "@/server/modules/import/services/import-link-reconciliation.service";

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

  // If sessions are provided, replace all existing sessions
  if (sessions !== undefined) {
    // Delete existing sessions
    await prisma.activitySession.deleteMany({
      where: { activityId },
    });
  }

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      ...activityData,
      sessions:
        sessions !== undefined
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
export async function deleteActivity(activityId: string): Promise<void> {
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
