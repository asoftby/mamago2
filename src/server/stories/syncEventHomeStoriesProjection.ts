import {
  ContentStatus,
  HomeStoryItemStatus,
  HomeStoryPlacementType,
  HomeStorySourceType,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { zonedDateKey, zonedDayRange } from "@/lib/stories/ranges";
import { getCityTimeZone } from "@/lib/stories/getCityTimeZone";
import { isStructuredFreeEvent } from "@/server/discovery/eventFilterSemantics";

export type AffectedHomeStoryDate = { cityId: string; storyDate: Date };

/**
 * Pure DB projection sync for one Event's HomeStoryItem rows — no
 * `next/cache` / `server-only` dependency, so it is safe to call from a CLI
 * script as well as from app code. Callers that need cache invalidation
 * (e.g. `syncEventHomeStories`) must invalidate the returned affected dates
 * themselves.
 */
export async function syncEventHomeStoriesProjection(
  activityId: string,
): Promise<Map<string, AffectedHomeStoryDate>> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true, status: true, title: true, shortDesc: true, slug: true,
      cityId: true, coverImageId: true, coverImageUrl: true,
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, mediaAssetId: true } },
      place: { select: { cityId: true, city: { select: { slug: true } } } },
      priceFrom: true, priceTo: true, priceText: true, scheduleJson: true,
      sessions: { where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 100 },
    },
  });
  const existing = await prisma.homeStoryItem.findMany({
    where: { sourceType: HomeStorySourceType.EVENT, sourceId: activityId },
  });
  const cityId = activity?.cityId ?? activity?.place?.cityId ?? null;
  const directCity = activity?.cityId
    ? await prisma.city.findUnique({ where: { id: activity.cityId }, select: { slug: true } })
    : null;
  const citySlug = directCity?.slug ?? activity?.place?.city?.slug ?? null;
  const active = activity?.status === ContentStatus.PUBLISHED && cityId && citySlug;
  const isFree = activity ? isStructuredFreeEvent(activity) : false;
  const keepKeys = new Set<string>();
  const affectedDates = new Map<string, AffectedHomeStoryDate>();

  await prisma.$transaction(async (tx) => {
    if (active && activity) {
      const timeZone = getCityTimeZone(cityId);
      const cover = resolveActivityCoverUrl(activity) ?? null;
      for (const session of activity.sessions) {
        const dateKey = zonedDateKey(session.startsAt, timeZone);
        const storyDate = zonedDayRange(dateKey, 1, timeZone).start;
        affectedDates.set(`${cityId}:${storyDate.toISOString()}`, { cityId, storyDate });
        // ActivitySession rows are rebuilt from scheduleJson by the existing
        // save flow, so their database ids are not durable identity.
        const occurrenceKey = `startsAt:${session.startsAt.toISOString()}`;
        keepKeys.add(`${occurrenceKey}:${storyDate.toISOString()}`);
        const key = { cityId_sourceType_sourceId_occurrenceKey_storyDate: {
          cityId, sourceType: HomeStorySourceType.EVENT, sourceId: activity.id, occurrenceKey, storyDate,
        } };
        const prior = existing.find((item) => item.occurrenceKey === occurrenceKey && item.storyDate.getTime() === storyDate.getTime());
        if (prior?.placementType === HomeStoryPlacementType.EXCLUDE) continue;
        await tx.homeStoryItem.upsert({
          where: key,
          create: {
            cityId, storyDate, sourceType: HomeStorySourceType.EVENT, sourceId: activity.id,
            occurrenceKey, placementType: HomeStoryPlacementType.AUTO, startsAt: session.startsAt,
            isFree,
            titleSnapshot: activity.title, subtitleSnapshot: activity.shortDesc,
            hrefSnapshot: `/${citySlug}/events/${activity.slug ?? activity.id}`, coverUrlSnapshot: cover,
          },
          update: {
            status: HomeStoryItemStatus.ACTIVE, inactiveReason: null, startsAt: session.startsAt,
            isFree,
            titleSnapshot: activity.title, subtitleSnapshot: activity.shortDesc,
            hrefSnapshot: `/${citySlug}/events/${activity.slug ?? activity.id}`, coverUrlSnapshot: cover,
          },
        });
      }
    }
    for (const item of existing) {
      if (item.placementType === HomeStoryPlacementType.EXCLUDE) continue;
      if (!keepKeys.has(`${item.occurrenceKey}:${item.storyDate.toISOString()}`)) {
        await tx.homeStoryItem.update({ where: { id: item.id }, data: {
          status: HomeStoryItemStatus.INACTIVE,
          inactiveReason: active ? "Occurrence больше не существует" : "Исходная активность недоступна",
        } });
      }
    }
  });
  for (const item of existing) {
    affectedDates.set(`${item.cityId}:${item.storyDate.toISOString()}`, {
      cityId: item.cityId,
      storyDate: item.storyDate,
    });
  }
  return affectedDates;
}
