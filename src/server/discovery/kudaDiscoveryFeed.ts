import { ActivityFormat, ActivityType, OccasionType, ScheduleMode } from "@prisma/client";
import { eventTemporalScore, KUDA_DEFAULT_HORIZON_DAYS, KUDA_SEASONAL_HORIZON_DAYS } from "@/server/discovery/eventTemporalRanking";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveKudaDiscoveryCityIds } from "@/server/discovery/discoveryHubExpand";
import { createDiscoveryPerf } from "@/server/discovery/discoveryPerf";
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

function hasActiveEventRuntimeFilters(filters: EventRuntimeFilters): boolean {
  return Boolean(
    filters.categorySlugs?.length ||
      filters.genreSlugs?.length ||
      filters.dateRange ||
      filters.free ||
      filters.priceMin !== null && filters.priceMin !== undefined ||
      filters.priceMax !== null && filters.priceMax !== undefined ||
      filters.districtId ||
      filters.metroId ||
      filters.adultOnly,
  );
}

export async function buildKudaDiscoveryWhere(cityId: string, citySlug: string, options: { format?: ActivityFormat | null; nearby?: boolean; eventFilters: EventRuntimeFilters }) {
  const now = new Date();
  const { primaryCityId, expandedCityIds } = await resolveKudaDiscoveryCityIds(citySlug, cityId);
  const pub = getPublicListingActivityWhere(now);
  // Explicit date selection is authoritative. Without it, discover the next
  // 45 days plus editorially tagged holiday/season events up to 90 days away.
  const horizon = new Date(now.getTime() + KUDA_DEFAULT_HORIZON_DAYS * 86_400_000);
  const seasonalHorizon = new Date(now.getTime() + KUDA_SEASONAL_HORIZON_DAYS * 86_400_000);
  const seasonalOccasion: Prisma.OccasionWhereInput = {
    isActive: true,
    type: { in: [OccasionType.HOLIDAY, OccasionType.SEASON] },
    OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: seasonalHorizon } }] }],
  };
  const defaultWindow: Prisma.ActivityWhereInput[] = options.eventFilters.dateRange ? [] : [{
    OR: [
      { sessions: { some: { startsAt: { gte: now, lt: horizon }, withdrawnAt: null } } },
      { nextOccurrenceAt: { gte: now, lt: horizon } },
      {
        occasionLinks: { some: { occasion: seasonalOccasion } },
        OR: [
          { sessions: { some: { startsAt: { gte: now, lt: seasonalHorizon }, withdrawnAt: null } } },
          { nextOccurrenceAt: { gte: now, lt: seasonalHorizon } },
        ],
      },
      { scheduleMode: { in: [ScheduleMode.ALWAYS, ScheduleMode.ON_DEMAND] }, nextOccurrenceAt: null },
    ],
  }];
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];
  const where: Prisma.ActivityWhereInput = { AND: [{ type: ActivityType.EVENT }, ...(options.format ? [{ format: options.format }] : options.nearby ? [{ format: { in: [ActivityFormat.OFFLINE, ActivityFormat.HYBRID] } }] : []), activityInAnyOfCitiesWhere(expandedCityIds), ...buildEventRuntimeWhere(options.eventFilters), ...defaultWindow, ...pubParts] };
  return { where, primaryCityId };
}

/**
 * Опубликованные события (EVENT) в городе для ленты «Куда пойти».
 * Temporal relevance takes priority; ownership does not change organic position.
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
  const perf = createDiscoveryPerf("kuda-feed");
  /** Больше кандидатов в ответе — клиент ранжирует по возрасту + показывает второй слой по engagement. */
  const take = options?.take ?? 80;
  const now = new Date();
  const runtimeFilters = options?.eventFilters ?? {
        categorySlugs: [],
        genreSlugs: [],
        dateRange: null,
        free: false,
        priceMin: null,
        priceMax: null,
        districtId: null,
        metroId: null,
        adultOnly: false,
      };
  const { where, primaryCityId } = await buildKudaDiscoveryWhere(cityId, citySlug, { format: options?.format ?? null, nearby: options?.nearby, eventFilters: runtimeFilters });
  perf.mark("where");

  /** Достаточно изображений, чтобы сопоставить coverImageId с ActivityImage (как на detail). */
  const GALLERY_FOR_COVER = 40;

  /** Пул кандидатов для сортировки; без избыточного findMany (было ×5 до 400 — долго на TTFB). */
  const rows = await prisma.activity.findMany({
    where,
    take: Math.min(take * 3, 200),
    orderBy: [{ nextOccurrenceAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
        take: GALLERY_FOR_COVER,
        select: { id: true, url: true, mediaAssetId: true },
      },
      sessions: { where: { withdrawnAt: null }, orderBy: { startsAt: "asc" }, take: 100 },
      eventCategory: { select: { nameRu: true } },
      place: { select: { cityId: true, city: { select: { slug: true } } } },
      venue: { select: { cityId: true } },
      occasionLinks: {
        where: { occasion: { isActive: true, type: { in: [OccasionType.HOLIDAY, OccasionType.SEASON] } } },
        select: { occasionId: true },
      },
      boosts: {
        where: { startAt: { lte: now }, endAt: { gt: now } },
        select: { id: true },
      },
    },
  });
  perf.mark("candidates");

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
  perf.mark("cityLookup");

  const scoreMap = await getEventEngagementScores(rows.map((r) => r.id));
  perf.mark("engagement");

  // Occasion boost is a soft contextual ranking signal, not a visibility rule.
  const occasionBoostMap = await getActivityOccasionBoosts(rows.map((r) => r.id));
  perf.mark("occasion");

  // Business quality boost — soft multiplier based on booking reputation.
  // Only applied when bookingCount30d >= 5. Max +10% to engagement score.
  const businessIds = Array.from(
    new Set(rows.map((r) => r.businessId).filter((id): id is string => id !== null)),
  );
  const qualityBoostMap = await getBusinessQualityBoostMap(businessIds);
  perf.mark("businessQuality");
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

  const temporalById = new Map(rows.map((row) => [
    row.id,
    eventTemporalScore({ now: runtimeFilters.dateRange?.start ?? now, nextOccurrenceAt: row.nextOccurrenceAt, sessions: row.sessions, seasonal: row.occasionLinks.length > 0 }),
  ]));

  cards.sort((a, b) => {
    const aWeatherBoost = options?.weather ? getWeatherRankingBoost(a, options.weather) : 0;
    const bWeatherBoost = options?.weather ? getWeatherRankingBoost(b, options.weather) : 0;
    // Time is the dominant organic signal; engagement/weather are capped so
    // long-lived boosted events cannot bury one-off events happening tomorrow.
    const aRank = (temporalById.get(a.id) ?? 0) + Math.min(12, Math.max(0, a.engagementScore ?? 0)) + aWeatherBoost;
    const bRank = (temporalById.get(b.id) ?? 0) + Math.min(12, Math.max(0, b.engagementScore ?? 0)) + bWeatherBoost;
    if (aRank !== bRank) return bRank - aRank;

    const ta = a.dateStart ? new Date(a.dateStart).getTime() : 0;
    const tb = b.dateStart ? new Date(b.dateStart).getTime() : 0;
    return ta - tb || a.id.localeCompare(b.id);
  });

  const result = cards.slice(0, take);
  perf.mark("mapSort");
  perf.log({
    citySlug,
    take,
    candidates: rows.length,
    resultCount: result.length,
    cityCount: cityRows.length,
    businessCount: businessIds.length,
    personalized: Boolean(currentUserId),
    weather: Boolean(options?.weather),
    filtered:
      hasActiveEventRuntimeFilters(runtimeFilters) ||
      Boolean(options?.format) ||
      Boolean(options?.nearby),
  });

  return result;
}

export async function countKudaDiscoveryEvents(
  cityId: string,
  citySlug: string,
  options: { format?: ActivityFormat | null; eventFilters: EventRuntimeFilters },
): Promise<number> {
  const perf = createDiscoveryPerf("kuda-count");
  const { where } = await buildKudaDiscoveryWhere(cityId, citySlug, options);
  perf.mark("where");
  const count = await prisma.activity.count({ where });
  perf.mark("count");
  perf.log({
    citySlug,
    count,
    filtered: hasActiveEventRuntimeFilters(options.eventFilters) || Boolean(options.format),
  });
  return count;
}
