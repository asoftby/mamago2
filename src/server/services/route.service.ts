import { prisma } from "@/lib/prisma";
import type { RouteStatus, RouteVisibility, BudgetLevel } from "@prisma/client";

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

/** List published public routes for catalog */
export async function listPublicRoutes(): Promise<RouteWithStops[]> {
  return prisma.route.findMany({
    where: { status: "PUBLISHED", visibility: "PUBLIC" },
    include: {
      city: { select: { id: true, name: true } },
      author: { select: { id: true, email: true } },
      stops: {
        orderBy: { order: "asc" },
        include: { place: { select: { id: true, title: true, formattedAddr: true, shortAddress: true, city: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** List published public routes filtered by city */
export async function listPublicRoutesByCity(cityId: string): Promise<RouteWithStops[]> {
  return prisma.route.findMany({
    where: { status: "PUBLISHED", visibility: "PUBLIC", cityId },
    include: {
      city: { select: { id: true, name: true } },
      author: { select: { id: true, email: true } },
      stops: {
        orderBy: { order: "asc" },
        include: { place: { select: { id: true, title: true, formattedAddr: true, shortAddress: true, city: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Get single route by slug */
export async function getRouteBySlug(slug: string): Promise<RouteWithStops | null> {
  return prisma.route.findUnique({
    where: { slug },
    include: {
      city: { select: { id: true, name: true } },
      author: { select: { id: true, email: true } },
      stops: {
        orderBy: { order: "asc" },
        include: { place: { select: { id: true, title: true, formattedAddr: true, shortAddress: true, city: { select: { name: true } } } } },
      },
    },
  });
}

/** List all routes by a specific user (any status) */
export async function listRoutesByUser(userId: string): Promise<RouteWithStops[]> {
  return prisma.route.findMany({
    where: { authorId: userId },
    include: {
      city: { select: { id: true, name: true } },
      author: { select: { id: true, email: true } },
      stops: {
        orderBy: { order: "asc" },
        include: { place: { select: { id: true, title: true, formattedAddr: true, shortAddress: true, city: { select: { name: true } } } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

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
  }
): Promise<{ id: string; slug: string }> {
  const slug = generateSlug(data.title);

  // Derive coverImageUrl from first stop with a photo
  const coverImageUrl =
    data.stops.find((s) => s.photoUrl)?.photoUrl ?? null;

  const status: RouteStatus = data.publish ? "PUBLISHED" : "DRAFT";

  return prisma.route.create({
    data: {
      slug,
      title: data.title,
      ageTags: data.ageTags,
      budgetLevel: data.budgetLevel,
      coverImageUrl,
      authorId: userId ?? null,
      status,
      visibility: data.visibility,
      stops: {
        create: data.stops.map((s) => ({
          order: s.order,
          address: s.address,
          note: s.note,
          photoUrl: s.photoUrl ?? null,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          placeId: s.placeId ?? null,
          customTitle: s.customTitle ?? null,
        })),
      },
    },
    select: { id: true, slug: true },
  });
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => RU_MAP[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base}-${Date.now().toString(36)}`;
}

const RU_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
  ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
