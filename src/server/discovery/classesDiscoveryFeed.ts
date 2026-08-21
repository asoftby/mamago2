import { ActivityFormat, type Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import type { ActivityMock } from "@/types/activity";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { getBusinessQualityBoostMap, applyActivePublicationBoost } from "@/server/services/ranking/businessQualityBoost";

function ageBoundsFromOffer(offer: {
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
}): { ageFrom: number; ageTo: number } {
  if (
    typeof offer.ageMinMonths === "number" &&
    typeof offer.ageMaxMonths === "number"
  ) {
    return {
      ageFrom: Math.max(0, Math.floor(offer.ageMinMonths / 12)),
      ageTo: Math.min(99, Math.ceil(offer.ageMaxMonths / 12)),
    };
  }

  return { ageFrom: 0, ageTo: 18 };
}

function extractOfferDateRange(input: {
  dateFrom: Date | null;
  dateTo: Date | null;
  campSessions: unknown;
}): {
  dateStart?: string;
  dateEnd?: string;
} {
  if (input.dateFrom || input.dateTo) {
    return {
      dateStart: input.dateFrom?.toISOString(),
      dateEnd: input.dateTo?.toISOString(),
    };
  }

  const campSessions = input.campSessions;
  if (!Array.isArray(campSessions) || campSessions.length === 0) return {};

  const timestamps = campSessions
    .flatMap((session) => {
      if (!session || typeof session !== "object") return [];
      const record = session as Record<string, unknown>;
      return [record.dateFrom, record.dateTo];
    })
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return {};

  return {
    dateStart: new Date(Math.min(...timestamps)).toISOString(),
    dateEnd: new Date(Math.max(...timestamps)).toISOString(),
  };
}

type GetClassesDiscoveryFeedOptions = {
  take?: number;
  chipSlug?: string | null;
  chipTitleBySlug?: Map<string, string>;
};

export async function getClassesDiscoveryFeed(
  cityId: string,
  citySlug: string,
  options?: GetClassesDiscoveryFeedOptions,
): Promise<ActivityMock[]> {
  const take = options?.take ?? 80;
  const chipSlug = options?.chipSlug && options.chipSlug !== "all" ? options.chipSlug : null;
  const publicWhere = getPublicPublishedOfferWhere();
  const publicWhereParts = (publicWhere.AND ?? []) as Prisma.OfferWhereInput[];
  const now = new Date();

  // classChipSlugs column may not exist yet (pending migration).
  // We try the full query first; if it fails with a missing-column error we
  // fall back to a query without the chip filter so the page still renders.
  let rows: Awaited<ReturnType<typeof runQuery>> = [];
  let classChipSlugsAvailable = true;

  try {
    rows = await runQuery({ publicWhereParts, cityId, chipSlug, now });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isMissingColumn =
      msg.includes("classChipSlugs") ||
      msg.includes("does not exist") ||
      msg.includes("P2022");

    if (isMissingColumn) {
      console.warn("[classesDiscoveryFeed] classChipSlugs column not found, falling back to unfiltered query");
      classChipSlugsAvailable = false;
      try {
        rows = await runQuery({ publicWhereParts, cityId, chipSlug: null, now, skipChipSlugsSelect: true });
      } catch {
        return [];
      }
    } else {
      throw err;
    }
  }

  const chipTitleBySlug = options?.chipTitleBySlug ?? new Map<string, string>();

  // Business quality boost — soft multiplier based on booking reputation.
  // Offer → place.ownerBusinessId → quality boost.
  const offerBusinessIds = Array.from(
    new Set(
      rows
        .map((r) => (r.place as { ownerBusinessId?: string | null }).ownerBusinessId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  const qualityBoostMap = await getBusinessQualityBoostMap(offerBusinessIds);

  const cards = rows.map<ActivityMock>((offer) => {
    const { ageFrom, ageTo } = ageBoundsFromOffer(offer);
    const cityForPath = (offer.place as { city?: { slug: string } | null }).city?.slug ?? citySlug;
    const chipSlugs: string[] = classChipSlugsAvailable
      ? ((offer as { classChipSlugs?: string[] }).classChipSlugs ?? [])
      : [];
    const chipTitles = chipSlugs
      .map((slug) => chipTitleBySlug.get(slug))
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const { dateStart, dateEnd } = extractOfferDateRange({
      dateFrom: offer.dateFrom,
      dateTo: offer.dateTo,
      campSessions: offer.campSessions,
    });
    const isBoosted = offer.boosts.length > 0;
    const baseEngagement = 0;

    // Apply quality boost (capped at +10%, no effect on promoted boosts)
    const businessId = (offer.place as { ownerBusinessId?: string | null }).ownerBusinessId;
    const qualityMultiplier = businessId ? (qualityBoostMap.get(businessId) ?? 1.0) : 1.0;
    // Don't apply quality boost to already-promoted offers (isBoosted = 1000)
    // to avoid double-boosting. Only apply to organic offers.
    const finalEngagement = applyActivePublicationBoost(
      baseEngagement,
      isBoosted,
      qualityMultiplier,
    );

    return {
      id: offer.id,
      slug: offer.slug,
      citySlug: cityForPath,
      type: "CLASS_SCHEDULE",
      discoveryIntent: "classes",
      analyticsEntityType: "OFFER",
      href: getOfferPublicPath({ slug: offer.slug }, cityForPath),
      title: offer.title,
      description: offer.description ?? "",
      image: offer.coverImage ?? "",
      ageFrom,
      ageTo,
      priceMin: offer.priceFrom ?? undefined,
      currency: "BYN",
      dateStart,
      dateEnd,
      format: ActivityFormat.OFFLINE,
      tags: chipSlugs,
      badge:
        chipTitles[0] ??
        (offer.campProgramType ? "Лагерь" : "Занятие"),
      engagementScore: finalEngagement,
    };
  });

  cards.sort((left, right) => {
    const boostDelta = (right.engagementScore ?? 0) - (left.engagementScore ?? 0);
    if (boostDelta !== 0) return boostDelta;

    const leftDate = left.dateStart ? new Date(left.dateStart).getTime() : 0;
    const rightDate = right.dateStart ? new Date(right.dateStart).getTime() : 0;
    if (leftDate !== rightDate) return rightDate - leftDate;

    return right.id.localeCompare(left.id);
  });

  return cards.slice(0, take);
}

// ─── Internal query helper ────────────────────────────────────────────────────

type RunQueryParams = {
  publicWhereParts: Prisma.OfferWhereInput[];
  cityId: string;
  chipSlug: string | null;
  now: Date;
  skipChipSlugsSelect?: boolean;
};

async function runQuery({ publicWhereParts, cityId, chipSlug, now, skipChipSlugsSelect = false }: RunQueryParams) {
  return prisma.offer.findMany({
    where: {
      AND: [
        ...publicWhereParts,
        { kind: "SERVICE" },
        { place: { cityId } },
        // Only add chip filter when column exists and chip is requested
        ...(chipSlug && !skipChipSlugsSelect
          ? [{ classChipSlugs: { has: chipSlug } } as Prisma.OfferWhereInput]
          : []),
      ],
    },
    take: 120,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      kind: true,
      campProgramType: true,
      title: true,
      description: true,
      coverImage: true,
      ageMinMonths: true,
      ageMaxMonths: true,
      priceFrom: true,
      dateFrom: true,
      dateTo: true,
      campSessions: true,
      // classChipSlugs is only selected when the column is known to exist
      ...(!skipChipSlugsSelect ? { classChipSlugs: true } : {}),
      place: {
        select: {
          ownerBusinessId: true,
          city: {
            select: { slug: true },
          },
        },
      },
      boosts: {
        where: {
          startAt: { lte: now },
          endAt: { gt: now },
        },
        select: { id: true },
      },
    },
  });
}
