import { prisma } from "@/lib/prisma";
import type { RouteStatus, RouteVisibility, BudgetLevel } from "@prisma/client";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import {
  generateRouteSlugFromTitle,
  findRouteBySlug,
} from "@/lib/slug/routeSlugService";
import {
  summarizeRouteBudget,
  type LegacyBudgetLevel,
  type RouteStopPriceType,
} from "@/lib/routes/routeBudget";
import { syncRouteMediaUsage } from "@/server/services/media/media-usage.service";

/**
 * Keep the route's media-usage projection in sync (Phase B invariant).
 * Best-effort: a projection hiccup must never fail the user's route save —
 * the next full recompute will reconcile.
 */
async function syncRouteMediaUsageSafe(routeId: string): Promise<void> {
  try {
    await syncRouteMediaUsage(routeId);
  } catch (error) {
    console.error(`[route.service] media usage sync failed for ${routeId}:`, error);
  }
}

const publicRouteStopPlaceWhere = {
  OR: [{ placeId: null }, { place: getPublicPublishedPlaceWhere() }],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteWithStops = {
  id: string;
  slug: string;
  title: string;
  ageTags: string[];
  budgetLevel: BudgetLevel;
  cityId: string | null;
  coverImageUrl: string | null;
  authorId: string | null;
  status: RouteStatus;
  visibility: RouteVisibility;
  seoTitle: string | null;
  seoDescription: string | null;
  seoJsonLdOverride: unknown | null;
  createdAt: Date;
  updatedAt: Date;
  city: { id: string; name: string } | null;
  author: { id: string; email: string } | null;
  stops: {
    id: string;
    order: number;
    placeId: string | null;
    lat: number | null;
    lng: number | null;
    address: string | null;
    customTitle: string | null;
    note: string;
    photoUrl: string | null;
    priceType: RouteStopPriceType;
    priceMin: number | null;
    priceMax: number | null;
    priceCurrency: string;
    priceNote: string | null;
    place: {
      id: string;
      title: string;
      formattedAddr: string | null;
      shortAddress: string | null;
      city: { name: string } | null;
    } | null;
  }[];
};

export type RouteStopInput = {
  order?: number;
  address?: string;
  note?: string;
  photoUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
  customTitle?: string | null;
  priceType?: RouteStopPriceType | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceCurrency?: string | null;
  priceNote?: string | null;
};

export type RouteWriteInput = {
  title: string;
  ageTags: string[];
  budgetLevel?: BudgetLevel;
  visibility: RouteVisibility;
  publish?: boolean;
  stops: RouteStopInput[];
};

type NormalizedStop = {
  order: number;
  address: string;
  note: string;
  photoUrl: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  customTitle: string | null;
  priceType: RouteStopPriceType;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;
  priceNote: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalizeStops(stops: RouteStopInput[]): NormalizedStop[] {
  return stops
    .filter(
      (s) =>
        s.placeId ||
        s.address?.trim() ||
        (s.lat != null && s.lng != null),
    )
    .map((s, i) => ({
      order: s.order ?? i + 1,
      address: s.address ?? "",
      note: s.note ?? "",
      photoUrl: s.photoUrl ?? null,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      placeId: s.placeId ?? null,
      customTitle: s.customTitle ?? null,
      priceType: s.priceType ?? "UNKNOWN",
      priceMin:
        typeof s.priceMin === "number" && Number.isFinite(s.priceMin)
          ? s.priceMin
          : null,
      priceMax:
        typeof s.priceMax === "number" && Number.isFinite(s.priceMax)
          ? s.priceMax
          : null,
      priceCurrency: s.priceCurrency?.trim() || "BYN",
      priceNote: s.priceNote?.trim() || null,
    }));
}

/**
 * Order-sensitive fingerprint of stops for equality comparison.
 * Covers only the fields written by normalizeStops — server-side enrichment
 * fields (googlePlaceId, formattedAddress, addressComponents, etc.) are excluded
 * so they are preserved rather than dropped when stops are unchanged.
 */
function buildRouteStopsFingerprint(
  stops: Array<{
    order: number;
    placeId: string | null;
    address: string | null | undefined;
    note: string | null | undefined;
    photoUrl: string | null;
    lat: number | null;
    lng: number | null;
    customTitle: string | null;
    priceType: RouteStopPriceType;
    priceMin: number | null;
    priceMax: number | null;
    priceCurrency: string;
    priceNote: string | null;
  }>,
): string {
  return JSON.stringify(
    stops.map((s) => [
      s.order,
      s.placeId ?? null,
      s.address ?? "",
      s.note ?? "",
      s.photoUrl ?? null,
      s.lat ?? null,
      s.lng ?? null,
      s.customTitle ?? null,
      s.priceType ?? "UNKNOWN",
      s.priceMin ?? null,
      s.priceMax ?? null,
      s.priceCurrency ?? "BYN",
      s.priceNote ?? null,
    ]),
  );
}

export function deriveCoverImageUrl(stops: NormalizedStop[]): string | null {
  return stops.find((s) => s.photoUrl)?.photoUrl ?? null;
}

function deriveLegacyBudgetLevel(
  normalizedStops: NormalizedStop[],
  fallbackBudgetLevel?: BudgetLevel | null,
): LegacyBudgetLevel {
  return summarizeRouteBudget(
    normalizedStops,
    fallbackBudgetLevel ?? null,
  ).legacyBudgetLevel;
}

export async function deriveCityIdFromStops(
  stops: NormalizedStop[],
): Promise<string | null> {
  const placeIds = stops
    .map((s) => s.placeId)
    .filter((id): id is string => id != null);

  if (placeIds.length === 0) return null;

  const places = await prisma.place.findMany({
    where: { id: { in: placeIds } },
    select: { id: true, cityId: true },
  });

  const cityCount = new Map<string, number>();
  for (const place of places) {
    if (place.cityId) {
      cityCount.set(place.cityId, (cityCount.get(place.cityId) ?? 0) + 1);
    }
  }

  if (cityCount.size === 0) return null;

  let topCityId: string | null = null;
  let topCount = 0;
  for (const [cityId, count] of cityCount) {
    if (count > topCount) {
      topCount = count;
      topCityId = cityId;
    }
  }
  return topCityId;
}

// ─── Shared include fragment ───────────────────────────────────────────────────

const routeWithStopsInclude = {
  city: { select: { id: true, name: true } },
  author: { select: { id: true, email: true } },
  stops: {
    orderBy: { order: "asc" as const },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          shortAddress: true,
          city: { select: { name: true } },
        },
      },
    },
  },
} as const;

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List published public routes for catalog */
export async function listPublicRoutes(): Promise<RouteWithStops[]> {
  return prisma.route.findMany({
    where: { status: "PUBLISHED", visibility: "PUBLIC" },
    include: routeWithStopsInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** List published public routes filtered by city */
export async function listPublicRoutesByCity(
  cityId: string,
): Promise<RouteWithStops[]> {
  return prisma.route.findMany({
    where: { status: "PUBLISHED", visibility: "PUBLIC", cityId },
    include: routeWithStopsInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** List published public routes filtered by several nearby cities */
export async function listPublicRoutesByCityIds(
  cityIds: string[],
): Promise<RouteWithStops[]> {
  if (cityIds.length === 0) return [];
  return prisma.route.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      cityId: { in: cityIds },
    },
    include: routeWithStopsInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Get single route by slug (public, filters stops by place visibility) */
export async function getRouteBySlug(
  slug: string,
): Promise<RouteWithStops | null> {
  return prisma.route.findUnique({
    where: { slug },
    include: {
      city: { select: { id: true, name: true } },
      author: { select: { id: true, email: true } },
      stops: {
        where: publicRouteStopPlaceWhere,
        orderBy: { order: "asc" },
        include: {
          place: {
            select: {
              id: true,
              title: true,
              formattedAddr: true,
              shortAddress: true,
              city: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Get a route by slug for editing — resolves slug history, checks authorship.
 * Returns null if not found or user is not the author.
 */
export async function getEditableRouteBySlug(
  slug: string,
  userId: string,
): Promise<RouteWithStops | null> {
  const resolved = await findRouteBySlug(slug);
  if (!resolved) return null;

  return prisma.route.findUnique({
    where: { id: resolved.routeId, authorId: userId },
    include: routeWithStopsInclude,
  });
}

/**
 * Resolve a Route for save-to-plan / ideas: by id first, then by slug (including slug history).
 */
export async function resolveRouteForUserSave(
  routeId: string,
  routeSlug?: string | null,
): Promise<{ id: string; title: string; coverImageUrl: string | null } | null> {
  const byId = await prisma.route.findUnique({
    where: { id: routeId },
    select: { id: true, title: true, coverImageUrl: true },
  });
  if (byId) return byId;

  const raw = routeSlug?.trim();
  if (!raw) return null;

  const resolved = await findRouteBySlug(raw);
  if (!resolved) return null;

  return prisma.route.findUnique({
    where: { id: resolved.routeId },
    select: { id: true, title: true, coverImageUrl: true },
  });
}

/** List all routes by a specific user (any status) */
export async function listRoutesByUser(
  userId: string,
): Promise<RouteWithStops[]> {
  return prisma.route.findMany({
    where: { authorId: userId },
    include: routeWithStopsInclude,
    orderBy: { createdAt: "desc" },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Create a new route (draft or published) */
export async function createRoute(
  userId: string | null,
  data: {
    title: string;
    ageTags: string[];
    budgetLevel?: BudgetLevel;
    visibility: RouteVisibility;
    publish?: boolean;
    stops: {
      order: number;
      address: string;
      note: string;
      photoUrl?: string;
      lat?: number;
      lng?: number;
      placeId?: string;
      customTitle?: string;
      priceType?: RouteStopPriceType | null;
      priceMin?: number | null;
      priceMax?: number | null;
      priceCurrency?: string | null;
      priceNote?: string | null;
    }[];
  },
): Promise<{ id: string; slug: string }> {
  const slug = await generateRouteSlugFromTitle(data.title);
  const normalizedStops = normalizeStops(data.stops);
  const coverImageUrl = deriveCoverImageUrl(normalizedStops);
  const cityId = await deriveCityIdFromStops(normalizedStops);
  const status: RouteStatus = data.publish ? "PUBLISHED" : "DRAFT";
  const budgetLevel = deriveLegacyBudgetLevel(
    normalizedStops,
    data.budgetLevel ?? null,
  );

  const created = await prisma.route.create({
    data: {
      slug,
      slugUpdatedAt: new Date(),
      title: data.title,
      ageTags: data.ageTags,
      budgetLevel,
      coverImageUrl,
      cityId,
      authorId: userId ?? null,
      status,
      visibility: data.visibility,
      stops: {
        create: normalizedStops,
      },
    },
    select: { id: true, slug: true },
  });

  await syncRouteMediaUsageSafe(created.id);

  return created;
}

/** Update an existing route (draft or published). Slug is never changed. */
export async function updateRoute(
  userId: string,
  routeId: string,
  data: RouteWriteInput,
): Promise<{ id: string; slug: string }> {
  const normalizedStops = normalizeStops(data.stops);
  const coverImageUrl = deriveCoverImageUrl(normalizedStops);
  const cityId = await deriveCityIdFromStops(normalizedStops);
  const status: RouteStatus = data.publish ? "PUBLISHED" : "DRAFT";
  const budgetLevel = deriveLegacyBudgetLevel(
    normalizedStops,
    data.budgetLevel ?? null,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.route.findUnique({
      where: { id: routeId },
      select: {
        id: true,
        slug: true,
        authorId: true,
        stops: {
          orderBy: { order: "asc" as const },
          select: {
            order: true,
            placeId: true,
            address: true,
            note: true,
            photoUrl: true,
            lat: true,
            lng: true,
            customTitle: true,
            priceType: true,
            priceMin: true,
            priceMax: true,
            priceCurrency: true,
            priceNote: true,
          },
        },
      },
    });

    if (!existing) throw new Error("ROUTE_NOT_FOUND");
    if (existing.authorId !== userId) throw new Error("ROUTE_FORBIDDEN");

    const stopsChanged =
      buildRouteStopsFingerprint(normalizedStops) !==
      buildRouteStopsFingerprint(existing.stops);

    if (stopsChanged) {
      await tx.routeStop.deleteMany({ where: { routeId } });
    }

    const routeScalarUpdate = {
      title: data.title,
      ageTags: data.ageTags,
      budgetLevel,
      visibility: data.visibility,
      status,
      cityId,
      coverImageUrl,
    };

    const result = await tx.route.update({
      where: { id: routeId },
      data: stopsChanged
        ? { ...routeScalarUpdate, stops: { create: normalizedStops } }
        : routeScalarUpdate,
      select: { id: true, slug: true },
    });

    return result;
  });

  await syncRouteMediaUsageSafe(updated.id);

  return updated;
}
