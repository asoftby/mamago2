import { ActivityFormat, ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveKudaDiscoveryCityIds } from "@/server/discovery/discoveryHubExpand";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import type { ActivityMock } from "@/types/activity";
import { getEventEngagementScores } from "@/server/discovery/eventEngagementScores";
import { getActivityOccasionBoosts } from "@/lib/discovery/occasions";
import { getBusinessQualityBoostMap, applyBusinessQualityBoost } from "@/server/services/ranking/businessQualityBoost";
import { normalizePricingMode } from "@/components/business/wizard/event/pricingMode";
import {
  getWeatherRankingBoost,
  type HomeWeatherScenario,
} from "@/features/hero-weather/lib/weather-scenario-layer";
import type { TimeOfDay } from "@/features/hero-weather/model/types";
import { ageBoundsFromActivityFields } from "@/lib/event/activityAgeBounds";

/** Мин/макс по сессиям и nextOccurrence — для подписи «4–5 апр.» / «4 апр.–5 мар.». */
function discoveryCardDatesFromActivity(a: {
  nextOccurrenceAt: Date | null;
  sessions: { startsAt: Date }[];
}): { dateStart?: string; dateEnd?: string } {
  const times: number[] = [];
  for (const s of a.sessions) {
    times.push(s.startsAt.getTime());
  }
  if (a.nextOccurrenceAt) times.push(a.nextOccurrenceAt.getTime());
  if (times.length === 0) return {};
  const min = Math.min(...times);
  const max = Math.max(...times);
  const start = new Date(min);
  const end = new Date(max);
  const ds = start.toISOString();
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return { dateStart: ds };
  }
  return { dateStart: ds, dateEnd: end.toISOString() };
}

function tagsFromSchedule(next: Date | null): string[] {
  if (!next) return [];
  const d = new Date(next);
  const day = d.getDay();
  const tags: string[] = [];
  if (day === 0 || day === 6) tags.push("weekend");
  else tags.push("today");
  return tags;
}

/** «от» только для режима «цена от»; фикс — без префикса. */
function discoveryCardPriceUsesOtPrefix(a: {
  scheduleJson: unknown;
  priceText: string | null;
  priceFrom: number | null;
  priceTo: number | null;
}): boolean {
  const sj = a.scheduleJson as Record<string, unknown> | null | undefined;
  const mode = normalizePricingMode(sj?.pricingMode, {
    priceText: a.priceText,
    priceFrom: a.priceFrom,
    priceTo: a.priceTo,
  });
  return mode === "from";
}

function resolveListingCityIdForKudaBadge(a: {
  cityId: string | null;
  place: { cityId: string | null } | null;
  venue: { cityId: string | null } | null;
}): string | null {
  return a.venue?.cityId ?? a.place?.cityId ?? a.cityId ?? null;
}

function mapActivityRowToCard(
  a: {
    id: string;
    slug: string | null;
    title: string;
    shortDesc: string;
    ageTags: string[];
    ageMinMonths: number | null;
    ageMaxMonths: number | null;
    priceFrom: number | null;
    priceTo: number | null;
    priceText: string | null;
    currency: string | null;
    priceDetails: string | null;
    scheduleJson: unknown;
    coverImageId: string | null;
    coverImageUrl: string | null;
    nextOccurrenceAt: Date | null;
    ownerUserId: string;
    format: ActivityFormat;
    cityId: string | null;
    place: { cityId: string | null; city: { slug: string } | null } | null;
    venue: { cityId: string | null } | null;
    eventCategory: { nameRu: string } | null;
    images: Array<{ id: string; url: string; mediaAssetId: string | null }>;
    sessions: Array<{ startsAt: Date }>;
  },
  ownerFirst: boolean,
  hubPrimaryCityId: string,
  engagementScore: number,
  citySlugById: Map<string, string>,
): ActivityMock {
  const { ageFrom, ageTo } = ageBoundsFromActivityFields(a);
  const cover =
    resolveActivityCoverUrl({
      coverImageId: a.coverImageId,
      coverImageUrl: a.coverImageUrl,
      images: a.images,
    }) ?? "";
  const { dateStart, dateEnd } = discoveryCardDatesFromActivity({
    nextOccurrenceAt: a.nextOccurrenceAt,
    sessions: a.sessions,
  });

  const isFreeByText = typeof a.priceText === "string" && a.priceText.toLowerCase().includes("бесплатно");
  const priceMin =
    a.priceFrom != null && !Number.isNaN(a.priceFrom)
      ? a.priceFrom
      : isFreeByText
        ? 0
        : undefined;

  const listingCityId = resolveListingCityIdForKudaBadge(a);
  const geoBadge =
    listingCityId && listingCityId !== hubPrimaryCityId ? "За городом" : undefined;
  const citySlug =
    a.place?.city?.slug ??
    (listingCityId ? citySlugById.get(listingCityId) ?? null : null);

  return {
    id: a.id,
    slug: a.slug,
    citySlug,
    format: a.format,
    type: "EVENT_FIXED",
    discoveryIntent: "kuda",
    title: a.title,
    description: a.shortDesc,
    image: cover,
    coverMediaId: a.coverImageId,
    ageFrom,
    ageTo,
    priceMin,
    priceMax: a.priceTo != null ? a.priceTo : undefined,
    priceListUsesOt: discoveryCardPriceUsesOtPrefix({
      scheduleJson: a.scheduleJson,
      priceText: a.priceText,
      priceFrom: a.priceFrom,
      priceTo: a.priceTo,
    }),
    priceDetails: a.priceDetails ?? undefined,
    currency: "BYN",
    dateStart,
    dateEnd,
    district: undefined,
    tags: tagsFromSchedule(a.nextOccurrenceAt ?? a.sessions[0]?.startsAt ?? null),
    badge: a.eventCategory?.nameRu ?? (ownerFirst ? "Моё событие" : "Событие"),
    geoBadge,
    engagementScore,
    reviewsCount: 0,
  };
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
    weather?: {
      scenario: HomeWeatherScenario;
      timeOfDay: TimeOfDay;
    };
  },
): Promise<ActivityMock[]> {
  /** Больше кандидатов в ответе — клиент ранжирует по возрасту + показывает второй слой по engagement. */
  const take = options?.take ?? 80;
  const { primaryCityId, expandedCityIds } = await resolveKudaDiscoveryCityIds(citySlug, cityId);
  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];

  const where: Prisma.ActivityWhereInput = {
    AND: [
      { type: ActivityType.EVENT },
      ...(options?.format
        ? [{ format: options.format }]
        : options?.nearby
          ? [{ format: { in: [ActivityFormat.OFFLINE, ActivityFormat.HYBRID] } }]
          : []),
      activityInAnyOfCitiesWhere(expandedCityIds),
      ...pubParts,
    ],
  };

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
    const qualityMultiplier = activityQualityBoost.get(a.id) ?? 1.0;
    const finalEngagement = applyBusinessQualityBoost(baseEngagement, qualityMultiplier);

    return mapActivityRowToCard(
      a,
      Boolean(currentUserId && a.ownerUserId === currentUserId),
      primaryCityId,
      finalEngagement,
      citySlugById,
    );
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
