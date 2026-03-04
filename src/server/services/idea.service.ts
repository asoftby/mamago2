import { prisma } from "@/lib/prisma";
import type { Idea } from "@prisma/client";

/**
 * Add an activity to user's saved ideas
 * Idempotent - won't fail if already exists
 */
export async function addIdea(
  userId: string,
  activityId: string
): Promise<Idea> {
  return await prisma.idea.upsert({
    where: {
      userId_activityId: {
        userId,
        activityId,
      },
    },
    create: {
      userId,
      activityId,
    },
    update: {},
  });
}

/**
 * Remove an activity from user's saved ideas
 * Idempotent - won't fail if doesn't exist
 */
export async function removeIdea(
  userId: string,
  activityId: string
): Promise<void> {
  await prisma.idea.deleteMany({
    where: {
      userId,
      activityId,
    },
  });
}

/**
 * List all saved ideas for a user
 * Returns ideas ordered by creation date (newest first)
 */
export async function listIdeas(userId: string): Promise<Idea[]> {
  return await prisma.idea.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Check if user has saved a specific activity as an idea
 */
export async function hasIdea(
  userId: string,
  activityId: string
): Promise<boolean> {
  const idea = await prisma.idea.findUnique({
    where: {
      userId_activityId: {
        userId,
        activityId,
      },
    },
  });
  return idea !== null;
}
