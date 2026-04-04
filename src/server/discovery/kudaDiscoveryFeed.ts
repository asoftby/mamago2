import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInAnyOfCitiesWhere } from "@/server/discovery/activityInCityWhere";
import { resolveKudaDiscoveryCityIds } from "@/server/discovery/discoveryHubExpand";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import type { ActivityMock } from "@/mocks/activity.types";
import { getEventEngagementScores } from "@/server/discovery/eventEngagementScores";
import { normalizePricingMode } from "@/components/business/wizard/event/pricingMode";

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
    cityId: string | null;
    place: { cityId: string | null } | null;
    venue: { cityId: string | null } | null;
    eventCategory: { nameRu: string } | null;
    images: Array<{ id: string; url: string }>;
    sessions: Array<{ startsAt: Date }>;
  },
  ownerFirst: boolean,
  hubPrimaryCityId: string,
  engagementScore: number,
): ActivityMock {
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

  const priceMin =
    a.priceFrom != null && !Number.isNaN(a.priceFrom)
      ? a.priceFrom
      : undefined;

  const listingCityId = resolveListingCityIdForKudaBadge(a);
  const geoBadge =
    listingCityId && listingCityId !== hubPrimaryCityId ? "За городом" : undefined;

  return {
    id: a.id,
    slug: a.slug,
    type: "EVENT_FIXED",
    discoveryIntent: "kuda",
    title: a.title,
    description: a.shortDesc,
    image: cover,
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
  options?: { take?: number },
): Promise<ActivityMock[]> {
  /** Больше кандидатов в ответе — клиент ранжирует по возрасту + показывает второй слой по engagement. */
  const take = options?.take ?? 80;
  const { primaryCityId, expandedCityIds } = await resolveKudaDiscoveryCityIds(citySlug, cityId);
  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];

  const where: Prisma.ActivityWhereInput = {
    AND: [
      { type: ActivityType.EVENT },
      activityInAnyOfCitiesWhere(expandedCityIds),
      ...pubParts,
    ],
  };

  /** Достаточно изображений, чтобы сопоставить coverImageId с ActivityImage (как на detail). */
  const GALLERY_FOR_COVER = 40;

  const rows = await prisma.activity.findMany({
    where,
    take: Math.min(take * 5, 400),
    orderBy: [{ nextOccurrenceAt: "desc" }, { createdAt: "desc" }],
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: GALLERY_FOR_COVER },
      sessions: { orderBy: { startsAt: "asc" }, take: 100 },
      eventCategory: { select: { nameRu: true } },
      place: { select: { cityId: true } },
      venue: { select: { cityId: true } },
    },
  });

  const scoreMap = await getEventEngagementScores(rows.map((r) => r.id));

  rows.sort((a, b) => {
    const aMine = currentUserId && a.ownerUserId === currentUserId ? 0 : 1;
    const bMine = currentUserId && b.ownerUserId === currentUserId ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    const sa = scoreMap.get(a.id) ?? 0;
    const sb = scoreMap.get(b.id) ?? 0;
    if (sa !== sb) return sb - sa;
    const ta = a.nextOccurrenceAt?.getTime() ?? a.createdAt.getTime();
    const tb = b.nextOccurrenceAt?.getTime() ?? b.createdAt.getTime();
    return tb - ta;
  });

  const sliced = rows.slice(0, take);

  return sliced.map((a) =>
    mapActivityRowToCard(
      a,
      Boolean(currentUserId && a.ownerUserId === currentUserId),
      primaryCityId,
      scoreMap.get(a.id) ?? 0,
    ),
  );
}
