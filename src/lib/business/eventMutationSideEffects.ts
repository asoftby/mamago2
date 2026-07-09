import { revalidatePath } from "next/cache";
import { ContentStatus, type PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveCanonicalCitySlugForEvent } from "@/lib/business/eventPublicLink";
import { resolveCanonicalEventPublicPathById } from "@/lib/business/resolveCanonicalEventPublicPath";
import { isServerSavePerfEnabled } from "@/server/utils/requestPerf";

type EventRevalidationContext = {
  activityCitySlug: string | null;
  placeCitySlug: string | null;
  venueCitySlug: string | null;
};

export type ActivityOccurrenceDebugState = {
  activityId: string;
  status: string;
  nextOccurrenceAt: Date | null;
  upcomingSessionsCount: number;
  totalSessionsCount: number;
  nearestUpcomingSessionStartsAt: Date | null;
};

type ActivityNextOccurrencePrisma = {
  activity: Pick<PrismaClient["activity"], "update">;
  activitySession: Pick<PrismaClient["activitySession"], "findFirst">;
};

async function getEventRevalidationContext(
  activityId: string,
): Promise<EventRevalidationContext | null> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      cityId: true,
      place: { select: { city: { select: { slug: true } } } },
      venue: {
        select: {
          cityId: true,
          place: { select: { city: { select: { slug: true } } } },
        },
      },
    },
  });

  if (!activity) {
    return null;
  }

  async function citySlugById(cityId: string | null | undefined): Promise<string | null> {
    const id = typeof cityId === "string" ? cityId.trim() : "";
    if (!id) {
      return null;
    }
    const city = await prisma.city.findUnique({
      where: { id },
      select: { slug: true },
    });
    return city?.slug ?? null;
  }

  const [activityCitySlug, venueCitySlug] = await Promise.all([
    citySlugById(activity.cityId),
    activity.venue?.place?.city?.slug
      ? Promise.resolve(activity.venue.place.city.slug)
      : citySlugById(activity.venue?.cityId),
  ]);

  return {
    activityCitySlug,
    placeCitySlug: activity.place?.city?.slug ?? null,
    venueCitySlug,
  };
}

export async function syncActivityNextOccurrenceAt(
  input: {
    prisma: ActivityNextOccurrencePrisma;
    activityId: string;
  },
): Promise<Date | null> {
  const { prisma, activityId } = input;
  const nextUpcomingSession = await prisma.activitySession.findFirst({
    where: {
      activityId,
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true },
  });

  const nextOccurrenceAt = nextUpcomingSession?.startsAt ?? null;

  await prisma.activity.update({
    where: { id: activityId },
    data: { nextOccurrenceAt },
  });

  return nextOccurrenceAt;
}

export async function getActivityOccurrenceDebugState(
  activityId: string,
  now: Date = new Date(),
): Promise<ActivityOccurrenceDebugState | null> {
  const [activity, upcomingSessionsCount, totalSessionsCount, nearestUpcomingSession] =
    await Promise.all([
      prisma.activity.findUnique({
        where: { id: activityId },
        select: {
          id: true,
          status: true,
          nextOccurrenceAt: true,
        },
      }),
      prisma.activitySession.count({
        where: {
          activityId,
          startsAt: { gte: now },
        },
      }),
      prisma.activitySession.count({
        where: { activityId },
      }),
      prisma.activitySession.findFirst({
        where: {
          activityId,
          startsAt: { gte: now },
        },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true },
      }),
    ]);

  if (!activity) {
    return null;
  }

  return {
    activityId: activity.id,
    status: activity.status,
    nextOccurrenceAt: activity.nextOccurrenceAt,
    upcomingSessionsCount,
    totalSessionsCount,
    nearestUpcomingSessionStartsAt: nearestUpcomingSession?.startsAt ?? null,
  };
}

export type EventMutationRevalidateScope =
  | "business-save"
  | "published-content-save"
  | "publish"
  | "moderation-status-change"
  | "visibility-change"
  | "slug-change"
  | "city-change";

export type EventRevalidationTargets = {
  publicPath: string | null;
  citySlug: string | null;
  publicPaths: string[];
};

export type EventMutationRevalidateResult = {
  publicPath: string | null;
  syncPaths: string[];
  skippedPaths: string[];
  removedPaths: Array<{ path: string; reason: string }>;
  scheduledAsyncPaths: string[];
  totalDurationMs: number;
  scope: EventMutationRevalidateScope;
};

const BUSINESS_LIST_PATHS = ["/business/events", "/business/publications/events"] as const;
const ADMIN_EVENT_PATHS = ["/admin/content/events", "/admin/moderation/events", "/admin"] as const;

function statusNeedsPublicCacheRefresh(status: string): boolean {
  return (
    status === ContentStatus.PUBLISHED ||
    status === ContentStatus.PENDING_UPDATE ||
    status === ContentStatus.SCHEDULED
  );
}

function getBusinessEventPaths(): string[] {
  return [
    ...BUSINESS_LIST_PATHS,
  ];
}

export function resolveEventPatchRevalidateScope(args: {
  currentStatus: string;
  slugChanged: boolean;
  cityChanged: boolean;
  visibilityChanged?: boolean;
  statusChanged?: boolean;
}): EventMutationRevalidateScope {
  if (args.statusChanged) {
    return "moderation-status-change";
  }
  if (args.visibilityChanged) {
    return "visibility-change";
  }
  if (args.slugChanged) {
    return "slug-change";
  }
  if (args.cityChanged) {
    return "city-change";
  }
  return statusNeedsPublicCacheRefresh(args.currentStatus)
    ? "published-content-save"
    : "business-save";
}

function timedRevalidatePath(path: string, reason: string): void {
  const started = isServerSavePerfEnabled() ? performance.now() : 0;
  revalidatePath(path);
  if (isServerSavePerfEnabled()) {
    console.info("[event-revalidate-path]", {
      path,
      reason,
      durationMs: Math.round(performance.now() - started),
    });
  }
}

export async function resolveEventRevalidationTargets(
  activityId: string,
): Promise<EventRevalidationTargets> {
  const [publicPath, context] = await Promise.all([
    resolveCanonicalEventPublicPathById(activityId),
    getEventRevalidationContext(activityId),
  ]);

  const citySlug = context ? resolveCanonicalCitySlugForEvent(context) : null;
  const publicPaths = new Set<string>();

  if (publicPath) {
    publicPaths.add(publicPath);
  }
  if (citySlug) {
    publicPaths.add(`/${citySlug}`);
    publicPaths.add(`/${citySlug}/events`);
  }

  return {
    publicPath,
    citySlug,
    publicPaths: [...publicPaths],
  };
}

export async function revalidateEventMutationPaths(
  activityId: string,
  scope: EventMutationRevalidateScope = "publish",
): Promise<EventMutationRevalidateResult> {
  const started = isServerSavePerfEnabled() ? performance.now() : 0;
  const syncPaths = new Set<string>(getBusinessEventPaths());
  const skippedPaths = new Set<string>();
  const removedPaths = [
    {
      path: `/editor/event/${activityId}/edit`,
      reason:
        "editor page keeps current form state on the client and already updates UX from PATCH response",
    },
    {
      path: `/business/events/${activityId}/edit`,
      reason:
        "legacy edit path only redirects to /editor/event/[id]/edit and does not need its own sync revalidate",
    },
  ];
  const scheduledAsyncPaths: string[] = [];

  const needsPublicTargets = scope !== "business-save";
  const targets = needsPublicTargets
    ? await resolveEventRevalidationTargets(activityId)
    : { publicPath: null, citySlug: null, publicPaths: [] };

  if (
    scope === "publish" ||
    scope === "moderation-status-change" ||
    scope === "visibility-change" ||
    scope === "slug-change" ||
    scope === "city-change"
  ) {
    for (const path of targets.publicPaths) {
      syncPaths.add(path);
    }
  } else if (scope === "published-content-save") {
    for (const path of targets.publicPaths) {
      skippedPaths.add(path);
    }
  }

  if (
    scope === "publish" ||
    scope === "moderation-status-change" ||
    scope === "visibility-change"
  ) {
    for (const path of ADMIN_EVENT_PATHS) {
      syncPaths.add(path);
    }
  }

  for (const path of syncPaths) {
    timedRevalidatePath(path, scope);
  }

  const result: EventMutationRevalidateResult = {
    publicPath: targets.publicPath,
    syncPaths: [...syncPaths],
    skippedPaths: [...skippedPaths],
    removedPaths,
    scheduledAsyncPaths,
    totalDurationMs: isServerSavePerfEnabled() ? Math.round(performance.now() - started) : 0,
    scope,
  };

  if (isServerSavePerfEnabled()) {
    console.info("[event-revalidate-plan]", result);
  }

  return result;
}
