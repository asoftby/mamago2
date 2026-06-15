import { ActivityType, type Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { activityInCityWhere } from "@/server/discovery/activityInCityWhere";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import {
  mapDiscoveryEventToActivityMock,
  type DiscoveryEventCardRow,
} from "@/server/discovery/mapDiscoveryEventToActivityMock";
import type { ActivityMock } from "@/types/activity";

const GALLERY_FOR_COVER = 40;

export function buildUpcomingPlaceEventsWhere(input: {
  placeId: string;
  cityId?: string | null;
  now?: Date;
}): Prisma.ActivityWhereInput {
  const now = input.now ?? new Date();
  const publicListing = getPublicListingActivityWhere(now);
  const publicParts = (publicListing.AND ?? []) as Prisma.ActivityWhereInput[];

  return {
    AND: [
      { type: ActivityType.EVENT },
      {
        OR: [
          { placeId: input.placeId },
          { venue: { placeId: input.placeId } },
        ],
      },
      ...(input.cityId ? [activityInCityWhere(input.cityId)] : []),
      ...publicParts,
    ],
  };
}

export async function loadUpcomingPlaceEvents(input: {
  placeId: string;
  cityId?: string | null;
  now?: Date;
  take?: number;
}) {
  const now = input.now ?? new Date();

  return prisma.activity.findMany({
    where: buildUpcomingPlaceEventsWhere({
      placeId: input.placeId,
      cityId: input.cityId,
      now,
    }),
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
        take: GALLERY_FOR_COVER,
        select: { id: true, url: true, mediaAssetId: true },
      },
      sessions: {
        where: { startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 100,
        select: { startsAt: true },
      },
      eventCategory: { select: { nameRu: true } },
      place: { select: { cityId: true, city: { select: { slug: true } } } },
      venue: { select: { cityId: true } },
    },
    orderBy: [{ nextOccurrenceAt: "asc" }, { createdAt: "asc" }],
    take: input.take ?? 10,
  });
}

export function mapUpcomingPlaceEventsToActivityMocks(
  rows: DiscoveryEventCardRow[],
  options: {
    hubCityId: string;
    citySlugById: Map<string, string>;
    currentUserId?: string | null;
  },
): ActivityMock[] {
  return rows.map((row) =>
    mapDiscoveryEventToActivityMock(row, {
      ownerFirst: Boolean(options.currentUserId && row.ownerUserId === options.currentUserId),
      hubPrimaryCityId: options.hubCityId,
      engagementScore: 0,
      citySlugById: options.citySlugById,
    }),
  );
}
