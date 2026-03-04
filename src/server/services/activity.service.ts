import { prisma } from "@/lib/prisma";
import type { Activity, ActivitySession } from "@prisma/client";

export type CreateActivityInput = {
  name: string;
  description?: string;
  cityId: string;
  coverImageUrl?: string;
  priceFrom?: number;
  currency?: string;
  ageLabel?: string;
  businessId?: string;
  createdBy: string;
  sessions?: Date[]; // Array of session start times
};

export type UpdateActivityInput = {
  name?: string;
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
  const { sessions, ...activityData } = input;

  const activity = await prisma.activity.create({
    data: {
      ...activityData,
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

  return activity;
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

  return activity;
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
  });
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
  });
}

/**
 * Delete an activity
 */
export async function deleteActivity(activityId: string): Promise<void> {
  await prisma.activity.delete({
    where: { id: activityId },
  });
}

/**
 * Check if user can manage activity
 * Business owners can only manage their own activities
 */
export async function canManageActivity(
  userId: string,
  activityId: string
): Promise<boolean> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { createdBy: true, businessId: true },
  });

  if (!activity) return false;

  // Check if user created this activity
  if (activity.createdBy === userId) return true;

  // Check if user owns the business
  if (activity.businessId) {
    const business = await prisma.business.findFirst({
      where: {
        id: activity.businessId,
        ownerUserId: userId,
      },
    });
    return business !== null;
  }

  return false;
}
