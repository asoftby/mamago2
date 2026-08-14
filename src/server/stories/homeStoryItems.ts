import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import {
  ContentStatus,
  HomeStoryItemStatus,
  HomeStoryPlacementType,
  HomeStorySourceType,
  OfferStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import { zonedDateKey, zonedDayRange } from "@/lib/stories/ranges";
import { getCityTimeZone } from "@/lib/stories/getCityTimeZone";

export const MAX_HOME_STORY_ITEMS_PER_DATE = 10;
export const MAX_HOME_STORY_ITEMS_PER_INTENT = 10;

export function homeStoriesTag(cityId: string, dateKey: string) {
  return `home-stories:${cityId}:${dateKey}`;
}

export function invalidateHomeStories(cityId: string, storyDate: Date) {
  const timeZone = getCityTimeZone(cityId);
  revalidateTag(homeStoriesTag(cityId, zonedDateKey(storyDate, timeZone)), "max");
}

export async function listPublicHomeStoryItems(input: {
  cityId: string;
  from: Date;
  until: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timeZone = getCityTimeZone(input.cityId);
  const dateKey = `${zonedDateKey(input.from, timeZone)}:${zonedDateKey(input.until, timeZone)}`;
  const tags: string[] = [];
  for (let cursor = input.from; cursor < input.until; cursor = new Date(cursor.getTime() + 86_400_000)) {
    tags.push(homeStoriesTag(input.cityId, zonedDateKey(cursor, timeZone)));
  }
  const run = () => prisma.homeStoryItem.findMany({
    where: {
      cityId: input.cityId,
      storyDate: { gte: input.from, lt: input.until },
      status: HomeStoryItemStatus.ACTIVE,
      placementType: { not: HomeStoryPlacementType.EXCLUDE },
      AND: [
        { OR: [
          { sourceType: HomeStorySourceType.EVENT },
          { sourceType: HomeStorySourceType.OFFER, placementType: HomeStoryPlacementType.FORCE_INCLUDE },
        ] },
        { OR: [{ displayFrom: null }, { displayFrom: { lte: now } }] },
        { OR: [{ displayUntil: null }, { displayUntil: { gt: now } }] },
      ],
    },
    orderBy: [
      { pinned: "desc" },
      { placementType: "desc" },
      { manualOrder: { sort: "asc", nulls: "last" } },
      { startsAt: "asc" },
      { id: "asc" },
    ],
    take: MAX_HOME_STORY_ITEMS_PER_DATE * 3,
  });
  return unstable_cache(run, [homeStoriesTag(input.cityId, dateKey)], {
    tags,
    revalidate: 300,
  })();
}

/** One bounded materialized query for the public Free intent. */
export async function listPublicFreeHomeStoryItems(input: {
  cityId: string;
  from: Date;
  until: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timeZone = getCityTimeZone(input.cityId);
  const dateKey = `free:${zonedDateKey(input.from, timeZone)}:${zonedDateKey(input.until, timeZone)}`;
  const tags: string[] = [];
  for (let cursor = input.from; cursor < input.until; cursor = new Date(cursor.getTime() + 86_400_000)) {
    tags.push(homeStoriesTag(input.cityId, zonedDateKey(cursor, timeZone)));
  }
  const run = () => prisma.homeStoryItem.findMany({
    where: {
      cityId: input.cityId,
      sourceType: HomeStorySourceType.EVENT,
      status: HomeStoryItemStatus.ACTIVE,
      isFree: true,
      placementType: { not: HomeStoryPlacementType.EXCLUDE },
      storyDate: { gte: input.from, lt: input.until },
      startsAt: { gte: now, lt: input.until },
      AND: [
        { OR: [{ displayFrom: null }, { displayFrom: { lte: now } }] },
        { OR: [{ displayUntil: null }, { displayUntil: { gt: now } }] },
      ],
    },
    orderBy: [
      { pinned: "desc" },
      { placementType: "desc" },
      { manualOrder: { sort: "asc", nulls: "last" } },
      { startsAt: "asc" },
      { id: "asc" },
    ],
    take: MAX_HOME_STORY_ITEMS_PER_INTENT,
    select: {
      id: true,
      sourceType: true,
      startsAt: true,
      titleSnapshot: true,
      subtitleSnapshot: true,
      hrefSnapshot: true,
      coverUrlSnapshot: true,
    },
  });
  return unstable_cache(run, [homeStoriesTag(input.cityId, dateKey)], {
    tags,
    revalidate: 300,
  })();
}

/** Idempotently refreshes only one Event projection; Offers never call this path. */
export async function syncEventHomeStories(activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true, status: true, title: true, shortDesc: true, slug: true,
      cityId: true, coverImageId: true, coverImageUrl: true,
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, mediaAssetId: true } },
      place: { select: { cityId: true, city: { select: { slug: true } } } },
      priceFrom: true,
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
  const keepKeys = new Set<string>();
  const affectedDates = new Map<string, { cityId: string; storyDate: Date }>();

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
            isFree: activity.priceFrom === 0,
            titleSnapshot: activity.title, subtitleSnapshot: activity.shortDesc,
            hrefSnapshot: `/${citySlug}/events/${activity.slug ?? activity.id}`, coverUrlSnapshot: cover,
          },
          update: {
            status: HomeStoryItemStatus.ACTIVE, inactiveReason: null, startsAt: session.startsAt,
            isFree: activity.priceFrom === 0,
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
  for (const affected of affectedDates.values()) {
    invalidateHomeStories(affected.cityId, affected.storyDate);
  }
}

export async function validateOfferSessionForManualPlacement(sessionId: string, cityId: string) {
  return prisma.offerSession.findFirst({
    where: { id: sessionId, offer: { status: OfferStatus.PUBLISHED, OR: [{ cityId }, { place: { cityId } }] } },
    select: {
      id: true, offerId: true, startAt: true, endAt: true,
      offer: { select: { title: true, description: true, slug: true, coverImage: true, cityId: true, place: { select: { cityId: true, city: { select: { slug: true } } } } } },
    },
  });
}

/** Refreshes only existing manual placements. It never creates one for an Offer. */
export async function syncOfferHomeStoryPlacements(offerId: string) {
  const placements = await prisma.homeStoryItem.findMany({
    where: { sourceType: HomeStorySourceType.OFFER, sourceId: offerId },
  });
  if (placements.length === 0) return;
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      id: true, status: true, title: true, description: true, slug: true, coverImage: true,
      cityId: true, place: { select: { cityId: true, city: { select: { slug: true } } } },
      sessions: { select: { id: true, startAt: true, endAt: true } },
    },
  });
  const sessions = new Map(offer?.sessions.map((session) => [session.id, session]));
  const sourceActive = offer?.status === OfferStatus.PUBLISHED;
  await prisma.$transaction(placements.map((item) => {
    const session = sessions.get(item.occurrenceKey);
    const valid = sourceActive && session && (offer?.cityId ?? offer?.place?.cityId) === item.cityId;
    return prisma.homeStoryItem.update({ where: { id: item.id }, data: valid && offer ? {
      status: HomeStoryItemStatus.ACTIVE, inactiveReason: null, startsAt: session.startAt, endsAt: session.endAt,
      titleSnapshot: offer.title, subtitleSnapshot: offer.description, coverUrlSnapshot: offer.coverImage,
      hrefSnapshot: `/${offer.place?.city?.slug ?? ""}/offers/${offer.slug ?? offer.id}`,
    } : {
      status: HomeStoryItemStatus.INACTIVE,
      inactiveReason: sourceActive ? "Occurrence больше не существует" : "Исходная активность недоступна",
    } });
  }));
  for (const item of placements) invalidateHomeStories(item.cityId, item.storyDate);
}
