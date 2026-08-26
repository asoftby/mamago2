import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import {
  HomeStoryItemStatus,
  HomeStoryPlacementType,
  HomeStorySourceType,
  OfferStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { zonedDateKey } from "@/lib/stories/ranges";
import { getCityTimeZone } from "@/lib/stories/getCityTimeZone";
import { storyRailCityCacheTag } from "@/lib/stories/cacheKey";
import { syncEventHomeStoriesProjection } from "./syncEventHomeStoriesProjection";

export const MAX_HOME_STORY_ITEMS_PER_DATE = 10;
export const MAX_HOME_STORY_ITEMS_PER_INTENT = 10;

export function homeStoriesTag(cityId: string, dateKey: string) {
  return `home-stories:${cityId}:${dateKey}`;
}

export function invalidateHomeStories(cityId: string, storyDate: Date) {
  const timeZone = getCityTimeZone(cityId);
  revalidateTag(homeStoriesTag(cityId, zonedDateKey(storyDate, timeZone)), "max");
  revalidateTag(storyRailCityCacheTag(cityId), "max");
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
  const affectedDates = await syncEventHomeStoriesProjection(activityId);
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
