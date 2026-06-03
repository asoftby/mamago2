import { prisma } from "@/lib/prisma";
import { resolveRouteForUserSave } from "@/server/services/route.service";

const planActivitySelect = {
  id: true,
  slug: true,
  title: true,
  type: true,
  coverImageUrl: true,
  ageLabel: true,
  eventCategory: { select: { nameRu: true } },
  priceFrom: true,
  priceText: true,
  currency: true,
  status: true,
  owner: {
    select: {
      business: { select: { operationalStatus: true } },
    },
  },
  place: {
    select: {
      shortAddress: true,
      formattedAddr: true,
      customAddress: true,
      city: { select: { name: true } },
    },
  },
  venue: {
    select: {
      addressLine: true,
      kind: true,
      place: {
        select: {
          shortAddress: true,
          formattedAddr: true,
          customAddress: true,
          city: { select: { name: true } },
        },
      },
    },
  },
  scheduleJson: true,
};

export type PlanItemWithActivity = {
  id: string;
  userId: string;
  activityId: string | null;
  /** Present on persisted rows; synthetic UI items may omit */
  routeId?: string | null;
  planRouteSlug?: string | null;
  date: string;
  startsAt: Date | null;
  title: string | null;
  coverImageUrl: string | null;
  createdAt: Date;
  activity: {
    id: string;
    slug: string | null;
    title: string;
    type: string;
    coverImageUrl: string | null;
    ageLabel: string | null;
    eventCategory: { nameRu: string } | null;
    priceFrom: number | null;
    priceText: string | null;
    currency: string | null;
    status: string;
    owner: {
      business: { operationalStatus: string } | null;
    } | null;
    place: {
      shortAddress: string | null;
      formattedAddr: string | null;
      customAddress: string | null;
      city: { name: string } | null;
    } | null;
    venue: {
      addressLine: string | null;
      kind: string;
      place: {
        shortAddress: string | null;
        formattedAddr: string | null;
        customAddress: string | null;
        city: { name: string } | null;
      } | null;
    } | null;
    /** Режим участия / ссылка на билеты — см. resolveActivityParticipationCta */
    scheduleJson?: unknown;
  } | null;
};
export type PlanReminderCandidate = PlanItemWithActivity;

/**
 * Candidate for tomorrow's plan digest notification.
 * Reuses PlanItemWithActivity shape which covers all fields needed
 * for building digest context (activity title, place, venue, city, startsAt).
 */
export type PlanTomorrowDigestCandidate = PlanItemWithActivity;


/**
 * Add or update an activity in user's plan for a specific date.
 * If the same activity already exists in the plan (any date), updates the date.
 * Prevents duplicate plan entries for the same activity.
 */
export async function addPlanItem(
  userId: string,
  activityId: string | null,
  date: string,
  startsAt?: Date,
  title?: string,
  coverImageUrl?: string
): Promise<{ id: string }> {
  // Only deduplicate when activityId is present
  if (activityId) {
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
  }

  return await prisma.planItem.create({
    data: { userId, activityId: activityId ?? null, date, startsAt: startsAt ?? null, title: title ?? null, coverImageUrl: coverImageUrl ?? null },
    select: { id: true },
  });
}

/**
 * Добавить маршрут в план на дату (дедупликация по userId + routeId).
 */
export async function addRoutePlanItem(
  userId: string,
  routeId: string,
  date: string,
  routeSlug?: string | null,
  options?: { title?: string | null; coverImageUrl?: string | null }
): Promise<{ id: string }> {
  const resolved = await resolveRouteForUserSave(routeId, routeSlug);
  if (resolved) {
    const existing = await prisma.planItem.findFirst({
      where: { userId, routeId: resolved.id },
      select: { id: true },
    });
    if (existing) {
      return prisma.planItem.update({
        where: { id: existing.id },
        data: {
          date,
          title: resolved.title,
          coverImageUrl: resolved.coverImageUrl,
          activityId: null,
          planRouteSlug: null,
        },
        select: { id: true },
      });
    }

    return prisma.planItem.create({
      data: {
        userId,
        routeId: resolved.id,
        planRouteSlug: null,
        activityId: null,
        date,
        title: resolved.title,
        coverImageUrl: resolved.coverImageUrl,
      },
      select: { id: true },
    });
  }

  void routeSlug;
  void options;
  throw new Error("Route not found");
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
 * List plan items from a given date onwards (up to 90 days).
 * Used by the upcoming plan widget.
 */
export async function listUpcomingPlanItems(
  userId: string,
  from: string
): Promise<PlanItemWithActivity[]> {
  const fromDate = new Date(from);
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + 90);
  const toDateStr = toDate.toISOString().split("T")[0]!;

  return (await prisma.planItem.findMany({
    where: { userId, date: { gte: from, lte: toDateStr } },
    include: {
      activity: { select: planActivitySelect },
    },
    orderBy: [{ date: "asc" }, { startsAt: "asc" }],
  })) as PlanItemWithActivity[];
}

/**
 * List plan items in a specific inclusive date range.
 * Used by lightweight summary endpoints/widgets.
 */
export async function listPlanItemsInRange(
  userId: string,
  from: string,
  to: string,
): Promise<PlanItemWithActivity[]> {
  return (await prisma.planItem.findMany({
    where: { userId, date: { gte: from, lte: to } },
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

export async function listPlanItemsDueForReminder(args: {
  windowStart: Date;
  windowEnd: Date;
}): Promise<PlanReminderCandidate[]> {
  return (await prisma.planItem.findMany({
    where: {
      activityId: { not: null },
      startsAt: {
        gte: args.windowStart,
        lte: args.windowEnd,
      },
    },
    include: {
      activity: { select: planActivitySelect },
    },
    orderBy: { startsAt: "asc" },
  })) as PlanReminderCandidate[];
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

/**
 * List plan items for tomorrow's digest — all users, all activities on a date.
 * Only returns items with an activityId (route-only items excluded).
 */
export async function listPlanItemsForTomorrowDigest(args: {
  date: string;
}): Promise<PlanTomorrowDigestCandidate[]> {
  return (await prisma.planItem.findMany({
    where: {
      date: args.date,
      activityId: { not: null },
    },
    include: {
      activity: { select: planActivitySelect },
    },
    orderBy: { startsAt: "asc" },
  })) as PlanTomorrowDigestCandidate[];
}
