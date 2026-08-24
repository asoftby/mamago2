import { ActivityFormat, ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveKudaDiscoveryCityIds } from "@/server/discovery/discoveryHubExpand";
import type { ActivityMock } from "@/types/activity";
import { getEventEngagementScores } from "@/server/discovery/eventEngagementScores";
import { getActivityOccasionBoosts } from "@/lib/discovery/occasions";
import { getBusinessQualityBoostMap, applyActivePublicationBoost } from "@/server/services/ranking/businessQualityBoost";
import {
  getWeatherRankingBoost,
  type HomeWeatherScenario,
} from "@/features/hero-weather/lib/weather-scenario-layer";
import type { TimeOfDay } from "@/features/hero-weather/model/types";
import { mapDiscoveryEventToActivityMock } from "@/server/discovery/mapDiscoveryEventToActivityMock";
import { buildEventRuntimeWhere, type EventRuntimeFilters } from "@/server/discovery/eventFilterSemantics";

export async function buildKudaDiscoveryWhere(cityId: string, citySlug: string, options: { format?: ActivityFormat | null; nearby?: boolean; eventFilters: EventRuntimeFilters }) {
  const now = new Date();
  const { primaryCityId, expandedCityIds } = await resolveKudaDiscoveryCityIds(citySlug, cityId);
  const pub = getPublicListingActivityWhere(now);
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];
  const where: Prisma.ActivityWhereInput = { AND: [{ type: ActivityType.EVENT }, ...(options.format ? [{ format: options.format }] : options.nearby ? [{ format: { in: [ActivityFormat.OFFLINE, ActivityFormat.HYBRID] } }] : []), activityInAnyOfCitiesWhere(expandedCityIds), ...buildEventRuntimeWhere(options.eventFilters), ...pubParts] };
  return { where, primaryCityId };
}

/**
 * Опубликованные события (EVENT) в городе для ленты «Куда пойти».
 * События текущего пользователя — выше остальных.
 * Только данные из БД (без моков и добора).
 */
export async function getKudaDiscoveryFeed(
  cityId: string,
  citySlug: string,
  currentUserId: string | null,
  options?: {
    take?: number;
    format?: ActivityFormat | null;
    nearby?: boolean;
    eventFilters?: EventRuntimeFilters;
    weather?: {
      scenario: HomeWeatherScenario;
      timeOfDay: TimeOfDay;
    };
  },
): Promise<ActivityMock[]> {
  /** Больше кандидатов в ответе — клиент ранжирует по возрасту + показывает второй слой по engagement. */
  const take = options?.take ?? 80;
  const now = new Date();
  const runtimeFilters = options?.eventFilters ?? {
        categorySlugs: [],
        genreSlugs: [],
        dateRange: null,
        free: false,
        priceMax: null,
        districtId: null,
        metroId: null,
        adultOnly: false,
      };
  const { where, primaryCityId } = await buildKudaDiscoveryWhere(cityId, citySlug, { format: options?.format ?? null, nearby: options?.nearby, eventFilters: runtimeFilters });

  /** Достаточно изображений, чтобы сопоставить coverImageId с ActivityImage (как на detail). */
  const GALLERY_FOR_COVER = 40;

  /** Пул кандидатов для сортировки; без избыточного findMany (было ×5 до 400 — долго на TTFB). */
  const rows = await prisma.activity.findMany({
    where,
    take: Math.min(take * 3, 200),
    orderBy: [{ nextOccurrenceAt: "desc" }, { createdAt: "desc" }],
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
        take: GALLERY_FOR_COVER,
        select: { id: true, url: true, mediaAssetId: true },
      },
      sessions: { orderBy: { startsAt: "asc" }, take: 100 },
      eventCategory: { select: { nameRu: true } },
      place: { select: { cityId: true, city: { select: { slug: true } } } },
      venue: { select: { cityId: true } },
      boosts: {
        where: { startAt: { lte: now }, endAt: { gt: now } },
        select: { id: true },
      },
    },
  });

  const cityIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.cityId, row.place?.cityId, row.venue?.cityId])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const cityRows =
    cityIds.length > 0
      ? await prisma.city.findMany({
          where: { id: { in: cityIds } },
          select: { id: true, slug: true },
        })
      : [];
  const citySlugById = new Map(cityRows.map((row) => [row.id, row.slug]));

  const scoreMap = await getEventEngagementScores(rows.map((r) => r.id));
  const ownerUserIdById = new Map(rows.map((row) => [row.id, row.ownerUserId]));

  // Occasion boost is a soft contextual ranking signal, not a visibility rule.
  const occasionBoostMap = await getActivityOccasionBoosts(rows.map((r) => r.id));

  // Business quality boost — soft multiplier based on booking reputation.
  // Only applied when bookingCount30d >= 5. Max +10% to engagement score.
  const businessIds = Array.from(
    new Set(rows.map((r) => r.businessId).filter((id): id is string => id !== null)),
  );
  const qualityBoostMap = await getBusinessQualityBoostMap(businessIds);
  // Map activityId → quality multiplier via businessId
  const activityQualityBoost = new Map<string, number>(
    rows.map((r) => [
      r.id,
      r.businessId ? (qualityBoostMap.get(r.businessId) ?? 1.0) : 1.0,
    ]),
  );

  const cards = rows.map((a) => {
    const baseEngagement = (scoreMap.get(a.id) ?? 0) + (occasionBoostMap.get(a.id) ?? 0);
    const isBoosted = a.boosts.length > 0;
    const qualityMultiplier = activityQualityBoost.get(a.id) ?? 1.0;
    const finalEngagement = applyActivePublicationBoost(
      baseEngagement,
      isBoosted,
      qualityMultiplier,
    );

    return mapDiscoveryEventToActivityMock(a, {
      ownerFirst: Boolean(currentUserId && a.ownerUserId === currentUserId),
      hubPrimaryCityId: primaryCityId,
      engagementScore: finalEngagement,
      citySlugById,
    });
  });

  cards.sort((a, b) => {
    const aMine = currentUserId && ownerUserIdById.get(a.id) === currentUserId ? 0 : 1;
    const bMine = currentUserId && ownerUserIdById.get(b.id) === currentUserId ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;

    const aWeatherBoost = options?.weather ? getWeatherRankingBoost(a, options.weather) : 0;
    const bWeatherBoost = options?.weather ? getWeatherRankingBoost(b, options.weather) : 0;
    const aRank = (a.engagementScore ?? 0) + aWeatherBoost;
    const bRank = (b.engagementScore ?? 0) + bWeatherBoost;
    if (aRank !== bRank) return bRank - aRank;

    const ta = a.dateStart ? new Date(a.dateStart).getTime() : 0;
    const tb = b.dateStart ? new Date(b.dateStart).getTime() : 0;
    return tb - ta;
  });

  return cards.slice(0, take);
}

export async function countKudaDiscoveryEvents(
  cityId: string,
  citySlug: string,
  options: { format?: ActivityFormat | null; eventFilters: EventRuntimeFilters },
): Promise<number> {
  const { where } = await buildKudaDiscoveryWhere(cityId, citySlug, options);
  return prisma.activity.count({ where });
}
