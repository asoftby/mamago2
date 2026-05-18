import { prisma } from "@/lib/prisma";
import type { RouteStatus, RouteVisibility, BudgetLevel } from "@prisma/client";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import {
  generateRouteSlugFromTitle,
  findRouteBySlug,
} from "@/lib/slug/routeSlugService";

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
};

export type RouteWriteInput = {
  title: string;
  ageTags: string[];
  budgetLevel: BudgetLevel;
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
    }));
}

export function deriveCoverImageUrl(stops: NormalizedStop[]): string | null {
  return stops.find((s) => s.photoUrl)?.photoUrl ?? null;
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
    budgetLevel: BudgetLevel;
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
    }[];
  },
): Promise<{ id: string; slug: string }> {
  const slug = await generateRouteSlugFromTitle(data.title);
  const normalizedStops = normalizeStops(data.stops);
  const coverImageUrl = deriveCoverImageUrl(normalizedStops);
  const cityId = await deriveCityIdFromStops(normalizedStops);
  const status: RouteStatus = data.publish ? "PUBLISHED" : "DRAFT";

  return prisma.route.create({
    data: {
      slug,
      slugUpdatedAt: new Date(),
      title: data.title,
      ageTags: data.ageTags,
      budgetLevel: data.budgetLevel,
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

  return prisma.$transaction(async (tx) => {
    const existing = await tx.route.findUnique({
      where: { id: routeId },
      select: { id: true, slug: true, authorId: true },
    });

    if (!existing) throw new Error("ROUTE_NOT_FOUND");
    if (existing.authorId !== userId) throw new Error("ROUTE_FORBIDDEN");

    await tx.routeStop.deleteMany({ where: { routeId } });

    const updated = await tx.route.update({
      where: { id: routeId },
      data: {
        title: data.title,
        ageTags: data.ageTags,
        budgetLevel: data.budgetLevel,
        visibility: data.visibility,
        status,
        cityId,
        coverImageUrl,
        stops: {
          create: normalizedStops,
        },
      },
      select: { id: true, slug: true },
    });

    return updated;
  });
}
