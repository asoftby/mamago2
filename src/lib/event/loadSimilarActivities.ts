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
import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { BYN_SYMBOL, formatPriceFrom } from "@/lib/formatters/format-price";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import type { EventPageSimilar } from "@/lib/event/eventPageTypes";
import { ageBoundsFromActivityFields } from "@/lib/event/activityAgeBounds";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInCityWhere } from "@/server/discovery/activityInCityWhere";

const FALLBACK_IMAGE = "/og-default.jpg";

function normalizePriceLabel(text: string): string {
  return text
    .replace(/\bBYN\b/gi, BYN_SYMBOL)
    .replace(/\bBr\b/gi, BYN_SYMBOL)
    .replace(/руб\.?/gi, BYN_SYMBOL)
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
  ageTags: string[];
  agePolicy: import("@prisma/client").AgePolicy;
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
  ageTags: true,
  agePolicy: true,
  images: {
    select: { id: true, url: true, mediaAssetId: true },
    orderBy: { sortOrder: "asc" as const },
    take: 1,
  },
  sessions: {
    where: { withdrawnAt: null },
    select: { id: true, startsAt: true },
    orderBy: { startsAt: "asc" as const },
    take: 1,
  },
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
    priceLabel = normalizePriceLabel(t);
  } else if (row.priceFrom === 0) {
    priceLabel = "Бесплатно";
  } else if (row.priceFrom != null) {
    priceLabel = formatPriceFrom(row.priceFrom);
  }

  const activityCitySlug = row.place?.city?.slug ?? citySlug;

  const { ageFrom, ageTo } = ageBoundsFromActivityFields(row);
  const ageLabel = ageTo >= 99 ? `${ageFrom}+` : `${ageFrom}–${ageTo}`;

  return {
    id: row.id,
    title: row.title,
    imageUrl,
    dateLabel,
    priceLabel,
    categoryLabel: row.eventCategory?.nameRu,
    ageLabel,
    href: publicActivityPath(row.id, activityCitySlug, row.slug),
    ageFrom,
    ageTo,
    agePolicy: row.agePolicy,
  };
}

export async function loadSimilarActivities(opts: {
  activityId: string;
  cityId: string;
  citySlug: string;
  eventCategoryId?: string | null;
  ageTags?: string[];
  limit?: number;
  sameCategoryOnly?: boolean;
}): Promise<EventPageSimilar[]> {
  const { activityId, cityId, citySlug, eventCategoryId, limit = 3, sameCategoryOnly = false } = opts;
  const now = new Date();

  const publicWhere = getPublicListingActivityWhere(now);
  const publicParts = (publicWhere.AND ?? []) as Prisma.ActivityWhereInput[];
  const baseWhere: Prisma.ActivityWhereInput = {
    AND: [
      { id: { not: activityId } },
      { type: ActivityType.EVENT },
      activityInCityWhere(cityId),
      ...publicParts,
    ],
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
  if (!sameCategoryOnly && results.length < limit) {
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
