import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type PlanItemWithActivity = Prisma.PlanItemGetPayload<{
  include: { activity: true };
}>;

/**
 * Add an activity to user's plan for a specific date
 */
export async function addPlanItem(
  userId: string,
  activityId: string,
  date: string, // YYYY-MM-DD format
  startsAt?: Date
): Promise<Prisma.PlanItemGetPayload<{}>> {
  return await prisma.planItem.create({
    data: {
      userId,
      activityId,
      date,
      startsAt: startsAt || null,
    },
  });
}

/**
 * Remove a plan item by ID
 */
export async function removePlanItem(
  userId: string,
  planItemId: string
): Promise<void> {
  await prisma.planItem.deleteMany({
    where: {
      id: planItemId,
      userId, // Security: ensure user owns this plan item
    },
  });
}

/**
 * List plan items for a specific week
 * @param userId - User ID
 * @param weekStartDate - Start date of the week (YYYY-MM-DD format, should be Monday)
 * @returns Plan items for the 7-day period starting from weekStartDate
 */
export async function listPlanItemsByWeek(
  userId: string,
  weekStartDate: string
): Promise<PlanItemWithActivity[]> {
  // Calculate end date (6 days after start)
  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  const endDateStr = endDate.toISOString().split("T")[0];

  return await prisma.planItem.findMany({
    where: {
      userId,
      date: {
        gte: weekStartDate,
        lte: endDateStr,
      },
    },
    include: {
      activity: true,
    },
    orderBy: [
      { date: "asc" },
      { startsAt: "asc" },
    ],
  });
}

/**
 * List all plan items for a user on a specific date
 */
export async function listPlanItemsByDate(
  userId: string,
  date: string
): Promise<PlanItemWithActivity[]> {
  return await prisma.planItem.findMany({
    where: {
      userId,
      date,
    },
    include: {
      activity: true,
    },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Group plan items by date
 * Useful for rendering week view
 */
export function groupPlanItemsByDate(
  planItems: PlanItemWithActivity[]
): Record<string, PlanItemWithActivity[]> {
  return planItems.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = [];
    }
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, PlanItemWithActivity[]>);
}

/**
 * Get the start of the current week (Monday)
 * Returns YYYY-MM-DD format
 */
export function getCurrentWeekStart(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
  
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  
  return monday.toISOString().split("T")[0];
}
