/**
 * Shared list filters for SEO entity providers (count / page queries).
 * Geo semantics mirror filterPagesByGeoContext; indexation mirrors
 * indexationStatusForPublishedEntity.
 */

import type { Prisma } from "@prisma/client";
import {
  ActivityType,
  ContentStatus,
  GeoScope,
  OfferStatus,
  RouteStatus,
  RouteVisibility,
} from "@prisma/client";
import type { SeoGeoContext } from "@/lib/admin/seo/geo";
import type { SeoPageIndexationStatus } from "@/lib/admin/seo/domain/types";

export type SeoEntityListFilters = {
  geoContext: SeoGeoContext;
  q?: string;
  indexation?: SeoPageIndexationStatus | "all";
};

export type SeoEntityPageWindow = {
  skip: number;
  take: number;
};

/**
 * Given per-provider counts in registry order, compute which slice of each
 * provider is needed for a global [skip, skip+take) window over the concat.
 */
export function planProviderPageWindows(
  counts: ReadonlyArray<number>,
  skip: number,
  take: number,
): Array<{ providerIndex: number; skip: number; take: number }> {
  const safeSkip = Math.max(0, skip);
  const safeTake = Math.max(0, take);
  if (safeTake === 0) return [];

  let remainingSkip = safeSkip;
  let remainingTake = safeTake;
  const windows: Array<{ providerIndex: number; skip: number; take: number }> =
    [];

  for (let i = 0; i < counts.length; i += 1) {
    const count = Math.max(0, counts[i] ?? 0);
    if (count === 0) continue;
    if (remainingSkip >= count) {
      remainingSkip -= count;
      continue;
    }
    const providerSkip = remainingSkip;
    const providerTake = Math.min(remainingTake, count - providerSkip);
    if (providerTake > 0) {
      windows.push({ providerIndex: i, skip: providerSkip, take: providerTake });
      remainingTake -= providerTake;
    }
    remainingSkip = 0;
    if (remainingTake <= 0) break;
  }

  return windows;
}

function robotsIndexedClause(): {
  OR: Array<
    | { seoRobots: null }
    | { seoRobots: string }
    | { NOT: { seoRobots: { contains: string; mode: "insensitive" } } }
  >;
} {
  return {
    OR: [
      { seoRobots: null },
      { seoRobots: "" },
      {
        NOT: {
          seoRobots: { contains: "noindex", mode: "insensitive" },
        },
      },
    ],
  };
}

function robotsNoindexClause(): {
  seoRobots: { contains: string; mode: "insensitive" };
} {
  return { seoRobots: { contains: "noindex", mode: "insensitive" } };
}

function emptyIdFilter(): { id: { in: string[] } } {
  return { id: { in: [] } };
}

// ─── Event ───────────────────────────────────────────────────────────────────

export function buildEventListWhere(
  filters: SeoEntityListFilters,
): Prisma.ActivityWhereInput {
  const and: Prisma.ActivityWhereInput[] = [
    { type: ActivityType.EVENT },
    { status: { not: ContentStatus.DELETED } },
  ];

  if (filters.indexation === "draft") {
    and.push({ status: { not: ContentStatus.PUBLISHED } });
  } else if (filters.indexation === "noindex") {
    and.push({ status: ContentStatus.PUBLISHED }, robotsNoindexClause());
  } else if (filters.indexation === "indexed") {
    and.push({ status: ContentStatus.PUBLISHED }, robotsIndexedClause());
  }

  const geo = filters.geoContext;
  if (geo.kind === "city") {
    and.push({
      OR: [
        { cityId: geo.cityId },
        { venue: { cityId: geo.cityId } },
        { place: { cityId: geo.cityId } },
      ],
    });
  } else if (geo.kind === "region") {
    if (geo.cityIds.length === 0) {
      and.push(emptyIdFilter());
    } else {
      and.push({
        OR: [
          { cityId: { in: geo.cityIds } },
          { venue: { cityId: { in: geo.cityIds } } },
          { place: { cityId: { in: geo.cityIds } } },
        ],
      });
    }
  } else if (geo.kind === "country") {
    // Events are city-scoped only; country context keeps COUNTRY-scoped rows.
    and.push(emptyIdFilter());
  }

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { seoTitle: { contains: q, mode: "insensitive" } },
        { seoH1: { contains: q, mode: "insensitive" } },
        { seoDescription: { contains: q, mode: "insensitive" } },
        { shortDesc: { contains: q, mode: "insensitive" } },
        { place: { city: { slug: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  return { AND: and };
}

// ─── Place ───────────────────────────────────────────────────────────────────

function placeIndexation(
  indexation: SeoPageIndexationStatus | "all" | undefined,
): Prisma.PlaceWhereInput | undefined {
  if (!indexation || indexation === "all") return undefined;
  if (indexation === "draft") {
    return { status: { not: ContentStatus.PUBLISHED } };
  }
  const robots =
    indexation === "noindex" ? robotsNoindexClause() : robotsIndexedClause();
  return { AND: [{ status: ContentStatus.PUBLISHED }, robots] };
}

export function buildPlaceListWhere(
  filters: SeoEntityListFilters,
): Prisma.PlaceWhereInput {
  const and: Prisma.PlaceWhereInput[] = [
    { archivedAt: null },
    { status: { not: ContentStatus.DELETED } },
  ];
  const idx = placeIndexation(filters.indexation);
  if (idx) and.push(idx);

  const geo = filters.geoContext;
  if (geo.kind === "city") {
    and.push({
      OR: [{ cityId: geo.cityId }, { city: { slug: geo.citySlug } }],
    });
  } else if (geo.kind === "region") {
    if (geo.cityIds.length === 0) and.push(emptyIdFilter());
    else {
      and.push({
        OR: [
          { cityId: { in: geo.cityIds } },
          { city: { slug: { in: geo.citySlugs } } },
        ],
      });
    }
  } else if (geo.kind === "country") {
    and.push(emptyIdFilter());
  }

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { seoTitle: { contains: q, mode: "insensitive" } },
        { seoH1: { contains: q, mode: "insensitive" } },
        { seoDescription: { contains: q, mode: "insensitive" } },
        { shortDesc: { contains: q, mode: "insensitive" } },
        { city: { slug: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: and };
}

// ─── Offer ───────────────────────────────────────────────────────────────────

function offerIndexation(
  indexation: SeoPageIndexationStatus | "all" | undefined,
): Prisma.OfferWhereInput | undefined {
  if (!indexation || indexation === "all") return undefined;
  if (indexation === "draft") {
    return {
      OR: [
        { status: { not: OfferStatus.PUBLISHED } },
        { archivedAt: { not: null } },
      ],
    };
  }
  const robots =
    indexation === "noindex" ? robotsNoindexClause() : robotsIndexedClause();
  return {
    AND: [{ status: OfferStatus.PUBLISHED }, { archivedAt: null }, robots],
  };
}

export function buildOfferListWhere(
  filters: SeoEntityListFilters,
): Prisma.OfferWhereInput {
  const and: Prisma.OfferWhereInput[] = [
    { status: { not: OfferStatus.REJECTED } },
  ];
  const idx = offerIndexation(filters.indexation);
  if (idx) and.push(idx);

  const geo = filters.geoContext;
  if (geo.kind === "city") {
    and.push({
      place: {
        OR: [{ cityId: geo.cityId }, { city: { slug: geo.citySlug } }],
      },
    });
  } else if (geo.kind === "region") {
    if (geo.cityIds.length === 0) and.push(emptyIdFilter());
    else {
      and.push({
        place: {
          OR: [
            { cityId: { in: geo.cityIds } },
            { city: { slug: { in: geo.citySlugs } } },
          ],
        },
      });
    }
  } else if (geo.kind === "country") {
    and.push(emptyIdFilter());
  }

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { seoTitle: { contains: q, mode: "insensitive" } },
        { seoH1: { contains: q, mode: "insensitive" } },
        { seoDescription: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { place: { city: { slug: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  return { AND: and };
}

// ─── Route ───────────────────────────────────────────────────────────────────

function routeIndexation(
  indexation: SeoPageIndexationStatus | "all" | undefined,
): Prisma.RouteWhereInput | undefined {
  if (!indexation || indexation === "all") return undefined;
  if (indexation === "draft") {
    return {
      OR: [
        { status: { not: RouteStatus.PUBLISHED } },
        { visibility: { not: RouteVisibility.PUBLIC } },
      ],
    };
  }
  const robots =
    indexation === "noindex" ? robotsNoindexClause() : robotsIndexedClause();
  return {
    AND: [
      { status: RouteStatus.PUBLISHED },
      { visibility: RouteVisibility.PUBLIC },
      robots,
    ],
  };
}

export function buildRouteListWhere(
  filters: SeoEntityListFilters,
): Prisma.RouteWhereInput {
  const and: Prisma.RouteWhereInput[] = [
    { status: { not: RouteStatus.ARCHIVED } },
  ];
  const idx = routeIndexation(filters.indexation);
  if (idx) and.push(idx);

  // Routes have no geo snapshot → only visible in "all" (same as filterPagesByGeoContext).
  if (filters.geoContext.kind !== "all") {
    and.push(emptyIdFilter());
  }

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { seoTitle: { contains: q, mode: "insensitive" } },
        { seoH1: { contains: q, mode: "insensitive" } },
        { seoDescription: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  return { AND: and };
}

// ─── Article ─────────────────────────────────────────────────────────────────

function articleIndexation(
  indexation: SeoPageIndexationStatus | "all" | undefined,
): Prisma.ArticleWhereInput | undefined {
  if (!indexation || indexation === "all") return undefined;
  if (indexation === "draft") {
    return { status: { not: ContentStatus.PUBLISHED } };
  }
  const robots =
    indexation === "noindex" ? robotsNoindexClause() : robotsIndexedClause();
  return { AND: [{ status: ContentStatus.PUBLISHED }, robots] };
}

export function buildArticleListWhere(
  filters: SeoEntityListFilters,
): Prisma.ArticleWhereInput {
  const and: Prisma.ArticleWhereInput[] = [
    { status: { not: ContentStatus.DELETED } },
  ];
  const idx = articleIndexation(filters.indexation);
  if (idx) and.push(idx);

  const geo = filters.geoContext;
  if (geo.kind === "city") {
    and.push({
      AND: [
        {
          OR: [{ cityId: geo.cityId }, { city: { slug: geo.citySlug } }],
        },
        {
          NOT: {
            geoScope: { in: [GeoScope.REGION, GeoScope.COUNTRY] },
          },
        },
      ],
    });
  } else if (geo.kind === "region") {
    const cityMatch =
      geo.cityIds.length > 0
        ? [
            { cityId: { in: geo.cityIds } },
            { city: { slug: { in: geo.citySlugs } } },
          ]
        : [];
    and.push({
      OR: [
        { regionId: geo.regionId },
        { AND: [{ geoScope: GeoScope.REGION }, { regionId: geo.regionId }] },
        ...cityMatch,
      ],
    });
  } else if (geo.kind === "country") {
    // Article has no countryId FK — country context matches geoScope COUNTRY only
    // (same as filterPagesByGeoContext when snapshot.countryId is unset).
    and.push({ geoScope: GeoScope.COUNTRY });
  }

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { seoTitle: { contains: q, mode: "insensitive" } },
        { seoH1: { contains: q, mode: "insensitive" } },
        { seoDescription: { contains: q, mode: "insensitive" } },
        { excerpt: { contains: q, mode: "insensitive" } },
        { city: { slug: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: and };
}
