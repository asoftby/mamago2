import { ActivityType, ScheduleMode, type Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import type { ActivityMock } from "@/mocks/activity.types";
import {
  getWeatherRankingBoost,
  type HomeWeatherScenario,
} from "@/features/hero-weather/lib/weather-scenario-layer";
import type { TimeOfDay } from "@/features/hero-weather/model/types";

function ageBoundsFromActivity(a: {
  ageTags: string[];
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
}): { ageFrom: number; ageTo: number } {
  if (a.ageMinMonths != null && a.ageMaxMonths != null) {
    return {
      ageFrom: Math.max(0, Math.floor(a.ageMinMonths / 12)),
      ageTo: Math.min(99, Math.ceil(a.ageMaxMonths / 12)),
    };
  }
  for (const tag of a.ageTags) {
    const m = tag.match(/^(\d+)\s*[-–]\s*(\d+)/);
    if (m) {
      return { ageFrom: parseInt(m[1], 10), ageTo: parseInt(m[2], 10) };
    }
  }
  return { ageFrom: 0, ageTo: 12 };
}

function discoveryCardDatesFromActivity(a: {
  nextOccurrenceAt: Date | null;
  sessions: { startsAt: Date }[];
}): { dateStart?: string; dateEnd?: string } {
  const times: number[] = [];
  for (const s of a.sessions) times.push(s.startsAt.getTime());
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

export async function getClassesDiscoveryFeed(
  cityIds: string[],
  options?: {
    take?: number;
    weather?: {
      scenario: HomeWeatherScenario;
      timeOfDay: TimeOfDay;
    };
  },
): Promise<ActivityMock[]> {
  if (cityIds.length === 0) return [];
  const take = options?.take ?? 8;
  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];

  const rows = await prisma.activity.findMany({
    where: {
      AND: [
        {
          OR: [{ type: ActivityType.COURSE }, { scheduleMode: ScheduleMode.RECURRING }],
        },
        activityInAnyOfCitiesWhere(cityIds),
        ...pubParts,
      ],
    },
    take: Math.min(take * 3, 60),
    orderBy: [{ nextOccurrenceAt: "asc" }, { createdAt: "desc" }],
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 20 },
      sessions: { orderBy: { startsAt: "asc" }, take: 50 },
      eventCategory: { select: { nameRu: true } },
      place: { select: { cityId: true, city: { select: { slug: true } } } },
      venue: { select: { cityId: true } },
    },
  });

  const cityIdsFromRows = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.cityId, row.place?.cityId, row.venue?.cityId])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const cityRows =
    cityIdsFromRows.length > 0
      ? await prisma.city.findMany({
          where: { id: { in: cityIdsFromRows } },
          select: { id: true, slug: true },
        })
      : [];
  const citySlugById = new Map(cityRows.map((row) => [row.id, row.slug]));

  const cards = rows.map((a) => {
    const { ageFrom, ageTo } = ageBoundsFromActivity(a);
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
    const listingCityId = a.venue?.cityId ?? a.place?.cityId ?? a.cityId ?? null;
    const citySlug =
      a.place?.city?.slug ??
      (listingCityId ? citySlugById.get(listingCityId) ?? null : null);

    return {
      id: a.id,
      slug: a.slug,
      citySlug,
      type: "CLASS_SCHEDULE" as const,
      discoveryIntent: "classes" as const,
      title: a.title,
      description: a.shortDesc,
      image: cover,
      ageFrom,
      ageTo,
      priceMin: a.priceFrom ?? undefined,
      priceMax: a.priceTo ?? undefined,
      currency: "BYN" as const,
      dateStart,
      dateEnd,
      tags: [],
      badge: a.eventCategory?.nameRu ?? "Занятие",
    };
  });

  cards.sort((a, b) => {
    const aWeatherBoost = options?.weather ? getWeatherRankingBoost(a, options.weather) : 0;
    const bWeatherBoost = options?.weather ? getWeatherRankingBoost(b, options.weather) : 0;
    if (aWeatherBoost !== bWeatherBoost) return bWeatherBoost - aWeatherBoost;

    const ta = a.dateStart ? new Date(a.dateStart).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.dateStart ? new Date(b.dateStart).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  return cards.slice(0, take);
}
