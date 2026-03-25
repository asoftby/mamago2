import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInCityWhere } from "@/server/discovery/activityInCityWhere";
import type { ActivityMock } from "@/mocks/activity.types";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1503095392213-2d6d34b949c6?q=80&w=800";

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

function tagsFromSchedule(next: Date | null): string[] {
  if (!next) return [];
  const d = new Date(next);
  const day = d.getDay();
  const tags: string[] = [];
  if (day === 0 || day === 6) tags.push("weekend");
  else tags.push("today");
  return tags;
}

function mapRowToMock(
  a: {
    id: string;
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
    coverImageUrl: string | null;
    nextOccurrenceAt: Date | null;
    ownerUserId: string;
    eventCategory: { nameRu: string } | null;
    images: Array<{ url: string }>;
    sessions: Array<{ startsAt: Date }>;
  },
  ownerFirst: boolean,
): ActivityMock {
  const { ageFrom, ageTo } = ageBoundsFromActivity(a);
  const cover =
    a.coverImageUrl?.trim() ||
    a.images[0]?.url ||
    FALLBACK_IMAGE;
  const dateStart =
    a.nextOccurrenceAt?.toISOString() ??
    a.sessions[0]?.startsAt.toISOString() ??
    undefined;

  const priceMin =
    a.priceFrom != null && !Number.isNaN(a.priceFrom)
      ? a.priceFrom
      : undefined;

  return {
    id: a.id,
    type: "EVENT_FIXED",
    discoveryIntent: "kuda",
    title: a.title,
    description: a.shortDesc,
    image: cover,
    ageFrom,
    ageTo,
    priceMin,
    priceMax: a.priceTo != null ? a.priceTo : undefined,
    priceDetails: a.priceDetails ?? undefined,
    currency: "BYN",
    dateStart,
    district: undefined,
    tags: tagsFromSchedule(a.nextOccurrenceAt ?? a.sessions[0]?.startsAt ?? null),
    badge: a.eventCategory?.nameRu ?? (ownerFirst ? "Моё событие" : "Событие"),
    rating: 4.5,
    reviewsCount: 0,
  };
}

/**
 * Опубликованные события (EVENT) в городе для ленты «Куда пойти».
 * События текущего пользователя — выше остальных.
 */
export async function getKudaDiscoveryFeedMocks(
  cityId: string,
  currentUserId: string | null,
  options?: { take?: number },
): Promise<ActivityMock[]> {
  const take = options?.take ?? 40;
  const pub = getPublicListingActivityWhere();
  const pubParts = (pub.AND ?? []) as Prisma.ActivityWhereInput[];

  const where: Prisma.ActivityWhereInput = {
    AND: [
      { type: ActivityType.EVENT },
      activityInCityWhere(cityId),
      ...pubParts,
    ],
  };

  const rows = await prisma.activity.findMany({
    where,
    take: Math.min(take * 2, 120),
    orderBy: [{ nextOccurrenceAt: "desc" }, { createdAt: "desc" }],
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 2 },
      sessions: { orderBy: { startsAt: "asc" }, take: 1 },
      eventCategory: { select: { nameRu: true } },
    },
  });

  rows.sort((a, b) => {
    const aMine = currentUserId && a.ownerUserId === currentUserId ? 0 : 1;
    const bMine = currentUserId && b.ownerUserId === currentUserId ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    const ta = a.nextOccurrenceAt?.getTime() ?? a.createdAt.getTime();
    const tb = b.nextOccurrenceAt?.getTime() ?? b.createdAt.getTime();
    return tb - ta;
  });

  const sliced = rows.slice(0, take);

  const mocks = sliced.map((a) =>
    mapRowToMock(
      a,
      Boolean(currentUserId && a.ownerUserId === currentUserId),
    ),
  );

  const seen = new Set(mocks.map((m) => m.id));
  const filler = MINSK_ACTIVITIES.filter((m) => !seen.has(m.id));
  return [...mocks, ...filler];
}
