import { ActivityType, MediaEntityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicListingActivityWhere, getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { activityInCityWhere } from "@/server/discovery/activityInCityWhere";
import { buildDateRangeWhere, buildOfferSessionOccurrenceWhere } from "@/lib/stories/dateRangeWhere";
import type { DateRange } from "@/lib/stories/types";
import type { ActivityParentClass, StoryRailCandidatePool } from "@/lib/stories/classify";
import {
  isSerialBySessionSpan,
  sessionSpanDays,
} from "@/lib/stories/serialConfig";

/**
 * One batch load for all temporal slot candidates in a city.
 *
 * Form: union-range fetch (sessions + orphan nextOccurrence + ongoing offers),
 * then in-memory classification per slot. Guarantees counts and viewer content
 * share the same predicate — no N-per-slot queries.
 */
export async function loadStoryRailCandidatePool(input: {
  cityId: string;
  unionRange: DateRange;
  timeZone: string;
  now?: Date;
}): Promise<StoryRailCandidatePool> {
  const now = input.now ?? new Date();
  const { cityId, unionRange, timeZone } = input;

  const pubActivity = getPublicListingActivityWhere(now);
  const pubActivityParts = Array.isArray(pubActivity.AND)
    ? pubActivity.AND
    : pubActivity.AND
      ? [pubActivity.AND]
      : [];

  const pubOffer = getPublicPublishedOfferWhere(now);
  const pubOfferParts = Array.isArray(pubOffer.AND)
    ? pubOffer.AND
    : pubOffer.AND
      ? [pubOffer.AND]
      : [];

  const sessionWhere = buildDateRangeWhere(unionRange, timeZone, "occurrence", {
    occurrenceField: "startsAt",
  }) as Prisma.ActivitySessionWhereInput;

  const offerSessionWhere = buildOfferSessionOccurrenceWhere(
    unionRange,
    timeZone,
  ) as Prisma.OfferSessionWhereInput;

  // Widest ongoing predicate (always/overlap) so policies a/b/c can filter in memory.
  const ongoingOverlapWhere = buildDateRangeWhere(unionRange, timeZone, "ongoing", {
    ongoingPolicy: "always",
  }) as Prisma.OfferWhereInput;

  const activityBase: Prisma.ActivityWhereInput = {
    AND: [
      { type: ActivityType.EVENT },
      activityInCityWhere(cityId),
      ...pubActivityParts,
    ],
  };

  const offerBase: Prisma.OfferWhereInput = {
    AND: [
      { OR: [{ cityId }, { place: { cityId } }] },
      ...pubOfferParts,
    ],
  };

  const [activitySessions, offerSessions, ongoingOffers, orphanActivities] =
    await Promise.all([
      prisma.activitySession.findMany({
        where: {
          AND: [
            sessionWhere,
            { activity: activityBase },
          ],
        },
        select: {
          id: true,
          startsAt: true,
          activityId: true,
          activity: {
            select: {
              title: true,
              placeId: true,
              coverImageId: true,
              coverImageUrl: true,
              venue: { select: { placeId: true } },
            },
          },
        },
      }),
      prisma.offerSession.findMany({
        where: {
          AND: [
            offerSessionWhere,
            { offer: offerBase },
          ],
        },
        select: {
          id: true,
          startAt: true,
          offerId: true,
          offer: {
            select: {
              title: true,
              placeId: true,
              coverImage: true,
            },
          },
        },
      }),
      prisma.offer.findMany({
        where: {
          AND: [
            offerBase,
            ongoingOverlapWhere,
            { sessions: { none: {} } },
          ],
        },
        select: {
          id: true,
          dateFrom: true,
          dateTo: true,
          title: true,
          placeId: true,
          coverImage: true,
        },
      }),
      prisma.activity.findMany({
        where: {
          AND: [
            activityBase,
            {
              nextOccurrenceAt: {
                gte: unionRange.start,
                lt: unionRange.end,
              },
            },
            {
              sessions: {
                none: {
                  startsAt: {
                    gte: unionRange.start,
                    lt: unionRange.end,
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          nextOccurrenceAt: true,
          title: true,
          placeId: true,
          coverImageId: true,
          coverImageUrl: true,
          venue: { select: { placeId: true } },
        },
      }),
    ]);

  const offerIdsForCover = [
    ...new Set([
      ...offerSessions.map((s) => s.offerId),
      ...ongoingOffers.map((o) => o.id),
    ]),
  ];

  const activityIdsForCover = [
    ...new Set([
      ...activitySessions.map((s) => s.activityId),
      ...orphanActivities.map((a) => a.id),
    ]),
  ];

  const coverUrlCandidates = [
    ...activitySessions.map((s) => s.activity.coverImageUrl?.trim()).filter(Boolean),
    ...orphanActivities.map((a) => a.coverImageUrl?.trim()).filter(Boolean),
    ...offerSessions.map((s) => s.offer.coverImage?.trim()).filter(Boolean),
    ...ongoingOffers.map((o) => o.coverImage?.trim()).filter(Boolean),
  ] as string[];

  const [offerCoverUsages, activityCoverUsages, urlAssets] = await Promise.all([
    offerIdsForCover.length > 0
      ? prisma.mediaUsage.findMany({
          where: {
            entityType: MediaEntityType.OFFER,
            entityId: { in: offerIdsForCover },
            field: "coverImage",
          },
          select: { entityId: true, mediaId: true },
        })
      : Promise.resolve([]),
    activityIdsForCover.length > 0
      ? prisma.mediaUsage.findMany({
          where: {
            entityType: MediaEntityType.EVENT,
            entityId: { in: activityIdsForCover },
            field: { in: ["coverImageId", "coverImageUrl"] },
          },
          select: { entityId: true, mediaId: true },
        })
      : Promise.resolve([]),
    coverUrlCandidates.length > 0
      ? prisma.mediaAsset.findMany({
          where: { publicUrl: { in: [...new Set(coverUrlCandidates)] } },
          select: { id: true, publicUrl: true },
        })
      : Promise.resolve([]),
  ]);

  const offerCoverByEntity = new Map(
    offerCoverUsages.map((u) => [u.entityId, u.mediaId]),
  );
  const activityCoverByEntity = new Map(
    activityCoverUsages.map((u) => [u.entityId, u.mediaId]),
  );
  const mediaIdByPublicUrl = new Map(
    urlAssets
      .filter((a): a is typeof a & { publicUrl: string } => Boolean(a.publicUrl))
      .map((a) => [a.publicUrl, a.id]),
  );

  function resolveActivityCover(input: {
    id: string;
    coverImageId: string | null;
    coverImageUrl: string | null;
  }): string | null {
    if (input.coverImageId) return input.coverImageId;
    const fromUsage = activityCoverByEntity.get(input.id);
    if (fromUsage) return fromUsage;
    const url = input.coverImageUrl?.trim();
    if (url) return mediaIdByPublicUrl.get(url) ?? null;
    return null;
  }

  function resolveOfferCover(input: {
    id: string;
    coverImage: string | null;
  }): string | null {
    const fromUsage = offerCoverByEntity.get(input.id);
    if (fromUsage) return fromUsage;
    const url = input.coverImage?.trim();
    if (url) return mediaIdByPublicUrl.get(url) ?? null;
    return null;
  }

  function resolveActivityPlaceId(input: {
    placeId: string | null;
    venue: { placeId: string | null } | null;
  }): string | null {
    return input.placeId ?? input.venue?.placeId ?? null;
  }

  const activityIdsWithSession = new Set(activitySessions.map((s) => s.activityId));

  const activityIdsForClass = [
    ...new Set([
      ...activitySessions.map((s) => s.activityId),
      ...orphanActivities.map((a) => a.id),
    ]),
  ];

  const sessionAggregates =
    activityIdsForClass.length > 0
      ? await prisma.activitySession.groupBy({
          by: ["activityId"],
          where: { activityId: { in: activityIdsForClass } },
          _count: { _all: true },
          _min: { startsAt: true },
          _max: { startsAt: true },
        })
      : [];

  const parentClassByActivity = new Map<string, ActivityParentClass>();
  for (const row of sessionAggregates) {
    const minAt = row._min.startsAt;
    const maxAt = row._max.startsAt;
    const sessionCount = row._count._all;
    if (!minAt || !maxAt) {
      parentClassByActivity.set(row.activityId, "point");
      continue;
    }
    parentClassByActivity.set(
      row.activityId,
      isSerialBySessionSpan({
        spanDays: sessionSpanDays(minAt, maxAt),
        sessionCount,
      })
        ? "serial"
        : "point",
    );
  }

  function parentClassFor(activityId: string): ActivityParentClass {
    return parentClassByActivity.get(activityId) ?? "point";
  }

  return {
    activitySessions: activitySessions.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      activityId: s.activityId,
      title: s.activity.title,
      placeId: resolveActivityPlaceId(s.activity),
      coverMediaAssetId: resolveActivityCover({
        id: s.activityId,
        coverImageId: s.activity.coverImageId,
        coverImageUrl: s.activity.coverImageUrl,
      }),
      parentClass: parentClassFor(s.activityId),
    })),
    activityOrphans: orphanActivities
      .filter((a): a is typeof a & { nextOccurrenceAt: Date } => Boolean(a.nextOccurrenceAt))
      .map((a) => ({
        id: a.id,
        nextOccurrenceAt: a.nextOccurrenceAt,
        title: a.title,
        placeId: resolveActivityPlaceId(a),
        coverMediaAssetId: resolveActivityCover({
          id: a.id,
          coverImageId: a.coverImageId,
          coverImageUrl: a.coverImageUrl,
        }),
        hasSessionInUnion: activityIdsWithSession.has(a.id),
        parentClass: parentClassFor(a.id),
      })),
    offerSessions: offerSessions.map((s) => ({
      id: s.id,
      startAt: s.startAt,
      offerId: s.offerId,
      title: s.offer.title,
      placeId: s.offer.placeId,
      coverMediaAssetId: resolveOfferCover({
        id: s.offerId,
        coverImage: s.offer.coverImage,
      }),
    })),
    ongoingOffers: ongoingOffers.map((o) => ({
      id: o.id,
      dateFrom: o.dateFrom,
      dateTo: o.dateTo,
      title: o.title,
      placeId: o.placeId,
      coverMediaAssetId: resolveOfferCover({
        id: o.id,
        coverImage: o.coverImage,
      }),
      hasSessions: false,
    })),
  };
}

/** Half-open union of slot ranges; null if no ranges. */
export function unionDateRanges(ranges: DateRange[]): DateRange | null {
  if (ranges.length === 0) return null;
  let start = ranges[0]!.start.getTime();
  let end = ranges[0]!.end.getTime();
  for (let i = 1; i < ranges.length; i++) {
    start = Math.min(start, ranges[i]!.start.getTime());
    end = Math.max(end, ranges[i]!.end.getTime());
  }
  return { start: new Date(start), end: new Date(end) };
}
