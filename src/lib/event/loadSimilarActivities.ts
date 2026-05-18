/**
 * loadSimilarActivities
 *
 * Серверная функция подбора похожих активностей для блока на странице события.
 * Возвращает до `limit` элементов EventPageSimilar.
 *
 * Приоритет:
 * 1. Та же категория + тот же город + ближайшие даты
 * 2. Тот же город + ближайшие даты (добор если меньше limit)
 *
 * Исключает текущее событие. Только опубликованные, не прошедшие.
 */

import prisma from "@/lib/prisma";
import { ActivityType, ContentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { formatPriceFrom } from "@/lib/formatters/format-price";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import type { EventPageSimilar } from "@/lib/event/eventPageTypes";

const FALLBACK_IMAGE = "/og-default.jpg";

type SimilarRow = {
  id: string;
  title: string;
  slug: string | null;
  coverImageUrl: string | null;
  coverImageId: string | null;
  priceText: string | null;
  priceFrom: number | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  images: Array<{ id: string; url: string; mediaAssetId: string | null }>;
  sessions: Array<{ id: string; startsAt: Date }>;
  place: { city: { slug: string } | null } | null;
  eventCategory: { nameRu: string } | null;
};

const SIMILAR_SELECT = {
  id: true,
  title: true,
  slug: true,
  coverImageUrl: true,
  coverImageId: true,
  priceText: true,
  priceFrom: true,
  ageMinMonths: true,
  ageMaxMonths: true,
  images: {
    select: { id: true, url: true, mediaAssetId: true },
    orderBy: { sortOrder: "asc" as const },
    take: 1,
  },
  sessions: { select: { id: true, startsAt: true }, orderBy: { startsAt: "asc" as const }, take: 1 },
  place: { select: { city: { select: { slug: true } } } },
  eventCategory: { select: { nameRu: true } },
} satisfies Prisma.ActivitySelect;

function rowToSimilar(row: SimilarRow, citySlug: string): EventPageSimilar {
  const imageUrl =
    resolveActivityCoverUrl({
      coverImageId: row.coverImageId,
      coverImageUrl: row.coverImageUrl,
      images: row.images,
    }) ?? FALLBACK_IMAGE;

  const firstSession = row.sessions[0];
  const dateLabel = firstSession
    ? formatRuShortDayMonth(firstSession.startsAt.toISOString())
    : undefined;

  let priceLabel: string | undefined;
  const t = row.priceText?.trim();
  if (t) {
    priceLabel = t;
  } else if (row.priceFrom === 0) {
    priceLabel = "Бесплатно";
  } else if (row.priceFrom != null) {
    priceLabel = formatPriceFrom(row.priceFrom);
  }

  const activityCitySlug = row.place?.city?.slug ?? citySlug;

  const ageLabel =
    row.ageMinMonths != null
      ? row.ageMaxMonths != null
        ? `${row.ageMinMonths}–${row.ageMaxMonths}+`
        : `${row.ageMinMonths}+`
      : undefined;

  return {
    id: row.id,
    title: row.title,
    imageUrl,
    dateLabel,
    priceLabel,
    categoryLabel: row.eventCategory?.nameRu,
    ageLabel,
    href: publicActivityPath(row.id, activityCitySlug, row.slug),
  };
}

export async function loadSimilarActivities(opts: {
  activityId: string;
  cityId: string;
  citySlug: string;
  eventCategoryId?: string | null;
  ageTags?: string[];
  limit?: number;
}): Promise<EventPageSimilar[]> {
  const { activityId, cityId, citySlug, eventCategoryId, limit = 3 } = opts;
  const now = new Date();

  const baseWhere: Prisma.ActivityWhereInput = {
    id: { not: activityId },
    type: ActivityType.EVENT,
    status: ContentStatus.PUBLISHED,
    cityId,
    sessions: {
      some: { startsAt: { gte: now } },
    },
  };

  const results: SimilarRow[] = [];
  const seenIds = new Set<string>();

  // ── Pass 1: та же категория ───────────────────────────────────────────────
  if (eventCategoryId) {
    const byCat = await prisma.activity.findMany({
      where: { ...baseWhere, eventCategoryId },
      select: SIMILAR_SELECT,
      orderBy: { nextOccurrenceAt: "asc" },
      take: limit,
    });
    for (const row of byCat) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        results.push(row);
      }
    }
  }

  // ── Pass 2: добор по городу если не хватает ───────────────────────────────
  if (results.length < limit) {
    const byCity = await prisma.activity.findMany({
      where: {
        ...baseWhere,
        id: { not: activityId, notIn: [...seenIds] },
      },
      select: SIMILAR_SELECT,
      orderBy: { nextOccurrenceAt: "asc" },
      take: limit - results.length,
    });
    for (const row of byCity) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        results.push(row);
      }
    }
  }

  return results.map((row) => rowToSimilar(row, citySlug));
}
