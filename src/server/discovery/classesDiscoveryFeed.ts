import { resolveTerritoryCityIds } from "@/server/territory/resolveTerritoryCityIds";
import { composePromotedCards } from "@/lib/discovery/promotionComposition";
import { recordDiscoveryExposures } from "@/server/services/recommendations/RecommendationTraceService";
import { placeInTerritoryScopeWhere, resolveTerritoryScope, resolveCountryScopeForTerritory } from "@/server/territory/territoryScope";
import { ActivityFormat, type AgePolicy, type Prisma, type PublicationPriceMode } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import type { ActivityMock } from "@/types/activity";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { getBusinessQualityBoostMap, applyActivePublicationBoost, getPublicationBoostLevel } from "@/server/services/ranking/businessQualityBoost";
import { ALL_BELARUS_REGIONS, getDiscoveryRegionContext, isBoostForDiscoveryRegion } from "@/server/geo/boostRegionTargeting";

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

export function projectOfferAudience(offer: {
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  agePolicy: AgePolicy;
}): Pick<ActivityMock, "ageFrom" | "ageTo" | "agePolicy"> {
  const bounds =
    offer.agePolicy === "ADULT_ONLY"
      ? { ageFrom: 18, ageTo: 99 }
      : ageBoundsFromOffer(offer);
  return { ...bounds, agePolicy: offer.agePolicy };
}

export function extractOfferDateRange(input: {
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

const NUMERIC_PRICE_MODES = ["FREE", "EXACT", "FROM", "RANGE"] as const;

type CanonicalOfferPriceFilter = {
  free?: boolean;
  priceMax?: number | null;
};

export function buildCanonicalOfferPriceWhere(
  input: CanonicalOfferPriceFilter,
): Prisma.OfferWhereInput | null {
  if (input.free) return { priceMode: "FREE" };
  if (input.priceMax == null || !Number.isFinite(input.priceMax) || input.priceMax < 0) {
    return null;
  }
  return {
    priceMode: { in: [...NUMERIC_PRICE_MODES] },
    priceFrom: { lte: input.priceMax },
  };
}

type GetClassesDiscoveryFeedOptions = {
  take?: number;
  onlyIds?: string[];
  productTypes?: Array<"REGULAR_ACTIVITY" | "ONE_TIME_ACTIVITY">;
  /** Homepage-only bounded organic fill from outside the current region. */
  homeGeoFallback?: boolean;
  chipSlug?: string | null;
  chipTitleBySlug?: Map<string, string>;
  free?: boolean;
  priceMax?: number | null;
};

type CanonicalOfferPrice = {
  priceMode: PublicationPriceMode;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
};

export function projectCanonicalOfferPrice(
  offer: CanonicalOfferPrice,
): Pick<ActivityMock, "priceMode" | "priceMin" | "priceMax" | "currency"> {
  return {
    priceMode: offer.priceMode,
    priceMin: offer.priceFrom ?? undefined,
    priceMax: offer.priceTo ?? undefined,
    currency: offer.currency as ActivityMock["currency"],
  };
}

export async function getClassesDiscoveryFeed(
  cityId: string,
  citySlug: string,
  options?: GetClassesDiscoveryFeedOptions,
): Promise<ActivityMock[]> {
  const take = options?.take ?? 80;
  const chipSlug = options?.chipSlug && options.chipSlug !== "all" ? options.chipSlug : null;
  const free = options?.free === true;
  const priceMax = free ? null : (options?.priceMax ?? null);
  const publicWhere = getPublicPublishedOfferWhere();
  const publicWhereParts = (publicWhere.AND ?? []) as Prisma.OfferWhereInput[];
  const now = new Date();
  const [scope, targetRegionId] = await Promise.all([resolveTerritoryScope(citySlug), getDiscoveryRegionContext(cityId, citySlug)]);
  const placeWhere = scope ? placeInTerritoryScopeWhere(scope.territoryIds) : { cityId };

  // classChipSlugs column may not exist yet (pending migration).
  // We try the full query first; if it fails with a missing-column error we
  // fall back to a query without the chip filter so the page still renders.
  let rows: Awaited<ReturnType<typeof runQuery>> = [];
  let classChipSlugsAvailable = true;

  try {
    rows = await runQuery({ publicWhereParts, cityId, placeWhere, targetRegionId, chipSlug, now, free, priceMax, take, onlyIds: options?.onlyIds, productTypes: options?.productTypes });
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
        rows = await runQuery({
          publicWhereParts,
          cityId,
          placeWhere,
          targetRegionId,
          chipSlug: null,
          now,
          free,
          priceMax,
          skipChipSlugsSelect: true,
          take,
          onlyIds: options?.onlyIds,
          productTypes: options?.productTypes,
        });
      } catch {
        return [];
      }
    } else {
      throw err;
    }
  }

  // Only the homepage's automatic region context may expand organically.
  // Explicit catalog filters and ID hydration remain strictly scoped.
  if (options?.homeGeoFallback && !options.onlyIds && rows.length < 10) {
    const country = scope ? await resolveCountryScopeForTerritory(scope) : null;
    if (country && country.type === "COUNTRY") {
      const external = await runQuery({
        publicWhereParts, cityId,
        placeWhere: placeInTerritoryScopeWhere(country.territoryIds),
        excludePlaceWhere: placeWhere,
        targetRegionId: null, chipSlug, now, free, priceMax,
        take: Math.min(24, Math.max(10 - rows.length, 1) * 3),
        productTypes: options.productTypes, skipChipSlugsSelect: !classChipSlugsAvailable,
      });
      rows = [...rows, ...external.filter(offer => !rows.some(local => local.id === offer.id))];
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

  const homeCityIds = scope ? await resolveTerritoryCityIds({ id: scope.territoryId, type: scope.type }) : [cityId];
  const cards = rows.map<ActivityMock>((offer) => {
    const audience = projectOfferAudience(offer);
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
    const crossRegion = offer.place?.cityId != null && !homeCityIds.includes(offer.place.cityId);
    const applicableBoosts = offer.boosts.filter(boost => isBoostForDiscoveryRegion(boost, targetRegionId, !crossRegion));
    const boostLevel = getPublicationBoostLevel(applicableBoosts);
    const isPromoted = boostLevel === "PAID";
    const baseEngagement = 0;

    // Quality only applies to organic results; free is a smaller +6 nudge.
    const businessId = (offer.place as { ownerBusinessId?: string | null }).ownerBusinessId;
    const qualityMultiplier = businessId ? (qualityBoostMap.get(businessId) ?? 1.0) : 1.0;
    const finalEngagement = applyActivePublicationBoost(
      baseEngagement,
      boostLevel,
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
      ...audience,
      ...projectCanonicalOfferPrice(offer),
      dateStart,
      dateEnd,
      format: ActivityFormat.OFFLINE,
      tags: chipSlugs,
      badge:
        chipTitles[0] ??
        (offer.campProgramType ? "Лагерь" : "Занятие"),
      engagementScore: finalEngagement,
      isPromoted,
      crossRegionReason: crossRegion && isPromoted ? "PAID_BOOST" : undefined,
    };
  });

  const localOfferIds = new Set(rows.filter(row => homeCityIds.includes(row.place?.cityId ?? "")).map(row => row.id));
  cards.sort((left, right) => {
    // Extra-region organic fill is lower priority; promoted offers stay governed
    // by the original promotion composition and published targeting rules.
    if (options?.homeGeoFallback && left.crossRegionReason !== "PAID_BOOST" && right.crossRegionReason !== "PAID_BOOST") {
      const leftLocal = localOfferIds.has(left.id);
      const rightLocal = localOfferIds.has(right.id);
      if (leftLocal !== rightLocal) return leftLocal ? -1 : 1;
    }
    const boostDelta = (right.engagementScore ?? 0) - (left.engagementScore ?? 0);
    if (boostDelta !== 0) return boostDelta;

    const leftDate = left.dateStart ? new Date(left.dateStart).getTime() : 0;
    const rightDate = right.dateStart ? new Date(right.dateStart).getTime() : 0;
    if (leftDate !== rightDate) return rightDate - leftDate;

    return right.id.localeCompare(left.id);
  });

  const selected = (options?.onlyIds ? cards : composePromotedCards(cards)).slice(0, take);
  if (!options?.onlyIds) await recordDiscoveryExposures(selected, cityId, citySlug, "classes");
  return selected;
}

// ─── Internal query helper ────────────────────────────────────────────────────

type RunQueryParams = {
  publicWhereParts: Prisma.OfferWhereInput[];
  cityId: string;
  placeWhere?: Prisma.PlaceWhereInput;
  targetRegionId: string | null;
  chipSlug: string | null;
  now: Date;
  free: boolean;
  priceMax: number | null;
  skipChipSlugsSelect?: boolean;
  take?: number;
  onlyIds?: string[];
  productTypes?: Array<"REGULAR_ACTIVITY" | "ONE_TIME_ACTIVITY">;
  excludePlaceWhere?: Prisma.PlaceWhereInput;
};

export function buildClassesDiscoveryWhere(input: Pick<RunQueryParams, "publicWhereParts" | "cityId" | "placeWhere" | "targetRegionId" | "chipSlug" | "now" | "free" | "priceMax" | "skipChipSlugsSelect" | "productTypes">): Prisma.OfferWhereInput {
  const { publicWhereParts, cityId, placeWhere, targetRegionId, chipSlug, now, free, priceMax, skipChipSlugsSelect = false, productTypes } = input;
  const priceWhere = buildCanonicalOfferPriceWhere({ free, priceMax });
  return {
      AND: [
        ...publicWhereParts,
        { kind: "SERVICE" },
        ...(productTypes ? [{ productType: { in: productTypes } }] : []),
        {
          OR: [
            { place: placeWhere ?? { cityId } },
            ...(targetRegionId ? [{
              boosts: { some: {
                isFreeDaily: false,
                purchaseRequestKey: { not: null },
                startAt: { lte: now }, endAt: { gt: now },
                OR: [
                  { targetRegionIds: { has: targetRegionId } },
                  { targetRegionIds: { has: ALL_BELARUS_REGIONS } },
                ],
              } },
            } satisfies Prisma.OfferWhereInput] : []),
          ],
        },
        ...(priceWhere ? [priceWhere] : []),
        // Only add chip filter when column exists and chip is requested
        ...(chipSlug && !skipChipSlugsSelect
          ? [{ classChipSlugs: { has: chipSlug } } as Prisma.OfferWhereInput]
          : []),
      ],
    };
}

async function runQuery({
  publicWhereParts,
  cityId,
  placeWhere,
  targetRegionId,
  chipSlug,
  now,
  free,
  priceMax,
  skipChipSlugsSelect = false,
  take = 80,
  onlyIds,
  productTypes,
  excludePlaceWhere,
}: RunQueryParams) {
  const where = buildClassesDiscoveryWhere({ publicWhereParts, cityId, placeWhere, targetRegionId, chipSlug, now, free, priceMax, skipChipSlugsSelect, productTypes });
  return prisma.offer.findMany({
    where: { AND: [where, ...(onlyIds ? [{ id: { in: onlyIds } }] : []),
      ...(excludePlaceWhere ? [{ NOT: { place: excludePlaceWhere } }] : [])] },
    take: onlyIds ? onlyIds.length : excludePlaceWhere ? take : Math.max(120, take),
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
      agePolicy: true,
      priceMode: true,
      priceFrom: true,
      priceTo: true,
      currency: true,
      dateFrom: true,
      dateTo: true,
      campSessions: true,
      // classChipSlugs is only selected when the column is known to exist
      ...(!skipChipSlugsSelect ? { classChipSlugs: true } : {}),
      place: {
        select: {
          ownerBusinessId: true,
          cityId: true,
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
        select: { id: true, targetRegionIds: true, isFreeDaily: true, purchaseRequestKey: true },
      },
    },
  });
}
