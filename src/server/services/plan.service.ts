import { prisma } from "@/lib/prisma";

const planActivitySelect = {
  id: true,
  title: true,
  type: true,
  coverImageUrl: true,
  ageLabel: true,
  status: true,
  owner: {
    select: {
      business: { select: { operationalStatus: true } },
    },
  },
};

export type PlanItemWithActivity = {
  id: string;
  userId: string;
  activityId: string | null;
  date: string;
  startsAt: Date | null;
  title: string | null;
  coverImageUrl: string | null;
  createdAt: Date;
  activity: {
    id: string;
    title: string;
    type: string;
    coverImageUrl: string | null;
    ageLabel: string | null;
    status: string;
    owner: {
      business: { operationalStatus: string } | null;
    } | null;
  } | null;
};

/**
 * Add or update an activity in user's plan for a specific date.
 * If the same activity already exists in the plan (any date), updates the date.
 * Prevents duplicate plan entries for the same activity.
 */
export async function addPlanItem(
  userId: string,
  activityId: string,
  date: string, // YYYY-MM-DD format
  startsAt?: Date,
  title?: string,
  coverImageUrl?: string
): Promise<{ id: string }> {
  // Check if this activity is already in the plan
  const existing = await prisma.planItem.findFirst({
    where: { userId, activityId },
    select: { id: true },
  });

  if (existing) {
    return await prisma.planItem.update({
      where: { id: existing.id },
      data: { date, startsAt: startsAt ?? null, title: title ?? null, coverImageUrl: coverImageUrl ?? null },
      select: { id: true },
    });
  }

  return await prisma.planItem.create({
    data: { userId, activityId, date, startsAt: startsAt ?? null, title: title ?? null, coverImageUrl: coverImageUrl ?? null },
    select: { id: true },
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
 */
export async function listPlanItemsByWeek(
  userId: string,
  weekStartDate: string
): Promise<PlanItemWithActivity[]> {
  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const endDateStr = endDate.toISOString().split("T")[0];

  return (await prisma.planItem.findMany({
    where: { userId, date: { gte: weekStartDate, lte: endDateStr } },
    include: {
      activity: { select: planActivitySelect },
    },
    orderBy: [{ date: "asc" }, { startsAt: "asc" }],
  })) as PlanItemWithActivity[];
}

/**
 * List ALL plan items for a user, grouped-ready (for /me/plan page)
 */
export async function listAllPlanItems(userId: string): Promise<PlanItemWithActivity[]> {
  return (await prisma.planItem.findMany({
    where: { userId },
    include: {
      activity: { select: planActivitySelect },
    },
    orderBy: [{ date: "asc" }, { startsAt: "asc" }],
  })) as PlanItemWithActivity[];
}

/**
 * List all plan items for a user on a specific date
 */
export async function listPlanItemsByDate(
  userId: string,
  date: string
): Promise<PlanItemWithActivity[]> {
  return (await prisma.planItem.findMany({
    where: { userId, date },
    include: {
      activity: { select: planActivitySelect },
    },
    orderBy: { startsAt: "asc" },
  })) as PlanItemWithActivity[];
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
