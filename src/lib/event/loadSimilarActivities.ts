/**
 * Event-detail recommendation surface policy.
 *
 * Candidate generation and scoring come exclusively from the shared EVENT
 * recommendation foundation. This module only applies event-detail composition
 * (same-category + item limit), materializes card fields, and records the
 * returned exposures.
 */

import prisma from "@/lib/prisma";
import {
  AnalyticsEntityType,
  PublicationPriceMode,
  RecommendationSurface,
  type Prisma,
} from "@prisma/client";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import {
  formatPrice,
  formatPriceFrom,
  formatPriceRange,
  normalizeUiCurrencyText,
} from "@/lib/formatters/format-price";
import { resolveActivityCoverUrl } from "@/lib/event/resolveActivityCoverUrl";
import type { EventPageSimilar } from "@/lib/event/eventPageTypes";
import { ageBoundsFromActivityFields } from "@/lib/event/activityAgeBounds";
import {
  rankPlanSuggestionsForCity,
  type RankedPlanSuggestion,
} from "@/server/services/planSuggestions.service";
import { recordRecommendationRun } from "@/server/services/recommendations/RecommendationTraceService";

const FALLBACK_IMAGE = "/og-default.jpg";

type SimilarRow = {
  id: string;
  title: string;
  slug: string | null;
  coverImageUrl: string | null;
  coverImageId: string | null;
  priceMode: PublicationPriceMode;
  priceText: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  ageTags: string[];
  agePolicy: import("@prisma/client").AgePolicy;
  images: Array<{ id: string; url: string; mediaAssetId: string | null }>;
  sessions: Array<{ id: string; startsAt: Date }>;
  place: { city: { slug: string } | null } | null;
  eventCategory: { nameRu: string } | null;
};

function priceLabelForRow(row: SimilarRow): string | undefined {
  switch (row.priceMode) {
    case PublicationPriceMode.FREE:
      return "Бесплатно";
    case PublicationPriceMode.FROM:
      return row.priceFrom != null
        ? formatPriceFrom(row.priceFrom)
        : row.priceText?.trim()
          ? `от ${normalizeUiCurrencyText(row.priceText)}`
          : undefined;
    case PublicationPriceMode.RANGE:
      return row.priceFrom != null || row.priceTo != null
        ? formatPriceRange(row.priceFrom, row.priceTo)
        : row.priceText?.trim()
          ? normalizeUiCurrencyText(row.priceText)
          : undefined;
    case PublicationPriceMode.EXACT:
      return row.priceFrom != null
        ? formatPrice(row.priceFrom)
        : row.priceText?.trim()
          ? normalizeUiCurrencyText(row.priceText)
          : undefined;
    case PublicationPriceMode.NONE:
      return undefined;
    case PublicationPriceMode.UNKNOWN:
    default:
      if (row.priceText?.trim()) return normalizeUiCurrencyText(row.priceText);
      if (row.priceFrom === 0) return "Бесплатно";
      return row.priceFrom != null ? formatPriceFrom(row.priceFrom) : undefined;
  }
}

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

  const activityCitySlug = row.place?.city?.slug ?? citySlug;
  const { ageFrom, ageTo } = ageBoundsFromActivityFields(row);
  const ageLabel = ageTo >= 99 ? `${ageFrom}+` : `${ageFrom}–${ageTo}`;

  return {
    id: row.id,
    title: row.title,
    imageUrl,
    dateLabel,
    priceLabel: priceLabelForRow(row),
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
  limit?: number;
  sameCategoryOnly?: boolean;
  userId?: string | null;
}): Promise<EventPageSimilar[]> {
  const {
    activityId,
    cityId,
    citySlug,
    eventCategoryId,
    limit = 4,
    sameCategoryOnly = true,
    userId = null,
  } = opts;

  const rankedBatch = await rankPlanSuggestionsForCity({
    citySlug,
    excludeActivityIds: [activityId],
    take: Math.max(limit * 8, 32),
  });

  const ranked = rankedBatch.suggestions.filter((item) =>
    sameCategoryOnly && eventCategoryId
      ? item.activity.eventCategory?.id === eventCategoryId
      : true,
  );
  const selectedRanked = ranked.slice(0, limit);
  if (selectedRanked.length === 0) {
    await recordRecommendationRun({
      userId,
      surface: RecommendationSurface.DISCOVERY,
      cityId,
      citySlug,
      algorithmVersion: rankedBatch.algorithmVersion,
      candidateCount: rankedBatch.candidateCount,
      items: [],
      decisionContext: {
        intent: "related_event_suggestions",
        subjects: [],
        constraints: eventCategoryId
          ? { eventCategoryId: { value: eventCategoryId, source: "derived" } }
          : undefined,
        actor: { kind: userId ? "user" : "guest", id: userId },
      },
    });
    return [];
  }

  const now = new Date();
  const ids = selectedRanked.map((item) => item.activity.id);
  const rows = (await prisma.activity.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      slug: true,
      coverImageUrl: true,
      coverImageId: true,
      priceMode: true,
      priceText: true,
      priceFrom: true,
      priceTo: true,
      ageMinMonths: true,
      ageMaxMonths: true,
      ageTags: true,
      agePolicy: true,
      images: {
        select: { id: true, url: true, mediaAssetId: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
      sessions: {
        where: { withdrawnAt: null, startsAt: { gte: now } },
        select: { id: true, startsAt: true },
        orderBy: { startsAt: "asc" },
        take: 1,
      },
      place: { select: { city: { select: { slug: true } } } },
      eventCategory: { select: { nameRu: true } },
    },
  })) as SimilarRow[];

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const results = selectedRanked
    .map((item) => rowById.get(item.activity.id))
    .filter((row): row is SimilarRow => Boolean(row))
    .map((row) => rowToSimilar(row, citySlug));

  const rankedById = new Map<string, RankedPlanSuggestion>(
    selectedRanked.map((item) => [item.activity.id, item]),
  );

  await recordRecommendationRun({
    userId,
    surface: RecommendationSurface.DISCOVERY,
    cityId,
    citySlug,
    algorithmVersion: rankedBatch.algorithmVersion,
    candidateCount: rankedBatch.candidateCount,
    items: results.map((item, index) => {
      const rankedItem = rankedById.get(item.id);
      return {
        entityType: AnalyticsEntityType.EVENT,
        entityId: item.id,
        position: index + 1,
        score: rankedItem?.score ?? null,
        scoreBreakdown: rankedItem?.scoreBreakdown as Prisma.InputJsonValue | undefined,
        reasonCodes: [
          ...(rankedItem?.reasonCodes ?? []),
          ...(eventCategoryId ? ["SAME_CATEGORY"] : []),
          "EVENT_DETAIL_SURFACE",
        ],
      };
    }),
    decisionContext: {
      intent: "related_event_suggestions",
      subjects: [],
      constraints: eventCategoryId
        ? { eventCategoryId: { value: eventCategoryId, source: "derived" } }
        : undefined,
      actor: { kind: userId ? "user" : "guest", id: userId },
    },
  });

  return results;
}
