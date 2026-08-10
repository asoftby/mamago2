import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Idea } from "@prisma/client";
import { resolveRouteForUserSave } from "@/server/services/route.service";

type OfferIdeaDelegate = {
  upsert: (args: {
    where: { userId_offerId: { userId: string; offerId: string } };
    create: { userId: string; offerId: string };
    update: Record<string, never>;
  }) => Promise<unknown>;
  deleteMany: (args: { where: { userId: string; offerId: string } }) => Promise<unknown>;
  findUnique: (args: {
    where: { userId_offerId: { userId: string; offerId: string } };
  }) => Promise<unknown | null>;
  findMany: (args: {
    where: { userId: string };
    orderBy: { createdAt: "desc" };
    include: {
      offer: {
        select: {
          id: true;
          title: true;
          coverImage: true;
          priceText: true;
          priceFrom: true;
          ageMinMonths: true;
          ageMaxMonths: true;
          dateFrom: true;
          dateTo: true;
          campSessions: true;
          slug: true;
          kind: true;
          campProgramType: true;
          place: {
            select: {
              title: true;
              formattedAddr: true;
              shortAddress: true;
              city: { select: { name: true; slug: true } };
            };
          };
        };
      };
    };
  }) => Promise<OfferIdeaListRow[]>;
};

export type OfferIdeaListRow = {
  id: string;
  createdAt: Date;
  userId: string;
  offerId: string;
  offer: {
    id: string;
    title: string;
    coverImage: string | null;
    priceText: string | null;
    priceFrom: number | null;
    ageMinMonths: number | null;
    ageMaxMonths: number | null;
    dateFrom: Date | null;
    dateTo: Date | null;
    campSessions?: unknown;
    slug: string | null;
    kind: string | null;
    campProgramType: string | null;
    place: {
      title: string;
      formattedAddr: string | null;
      shortAddress: string | null;
      city: {
        name: string;
        slug: string;
      } | null;
    } | null;
  } | null;
};

function getOfferIdeaDelegate(): OfferIdeaDelegate | null {
  const candidate = (prisma as typeof prisma & { offerIdea?: OfferIdeaDelegate }).offerIdea;
  return candidate ?? null;
}

function isOfferIdeaTableMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.table ?? "").includes("OfferIdea")
  );
}

export function hasOfferIdeaSupport(): boolean {
  return getOfferIdeaDelegate() !== null;
}

export async function listOfferIdeas(userId: string) {
  const delegate = getOfferIdeaDelegate();
  if (!delegate) return [];
  try {
    return await delegate.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        offer: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            priceText: true,
            priceFrom: true,
            ageMinMonths: true,
            ageMaxMonths: true,
            dateFrom: true,
            dateTo: true,
            campSessions: true,
            slug: true,
            kind: true,
            campProgramType: true,
            place: {
              select: {
                title: true,
                formattedAddr: true,
                shortAddress: true,
                city: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    });
  } catch (error) {
    if (isOfferIdeaTableMissing(error)) return [];
    throw error;
  }
}

/**
 * Add an activity to user's saved ideas
 * Idempotent - won't fail if already exists
 */
export async function addIdea(
  userId: string,
  activityId: string
): Promise<Idea> {
  return await prisma.idea.upsert({
    where: {
      userId_activityId: {
        userId,
        activityId,
      },
    },
    create: {
      userId,
      activityId,
    },
    update: {},
  });
}

/**
 * Remove an activity from user's saved ideas
 * Idempotent - won't fail if doesn't exist
 */
export async function removeIdea(
  userId: string,
  activityId: string
): Promise<void> {
  await prisma.idea.deleteMany({
    where: {
      userId,
      activityId,
    },
  });
}

/**
 * List all saved ideas for a user
 * Returns ideas ordered by creation date (newest first)
 */
export async function listIdeas(userId: string): Promise<Idea[]> {
  return await prisma.idea.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Check if user has saved a specific activity as an idea
 */
export async function hasIdea(
  userId: string,
  activityId: string
): Promise<boolean> {
  const idea = await prisma.idea.findUnique({
    where: {
      userId_activityId: {
        userId,
        activityId,
      },
    },
  });
  return idea !== null;
}

/** Сохранить маршрут в «Идеи» (idempotent). */
export async function addRouteIdea(
  userId: string,
  routeId: string,
  routeSlug?: string | null
) {
  const route = await resolveRouteForUserSave(routeId, routeSlug);
  if (!route) {
    throw new Error("Route not found");
  }
  return prisma.routeIdea.upsert({
    where: {
      userId_routeId: { userId, routeId: route.id },
    },
    create: { userId, routeId: route.id },
    update: {},
  });
}

/** Сохранить предложение в «Идеи» (idempotent). */
export async function addOfferIdea(userId: string, offerId: string) {
  const delegate = getOfferIdeaDelegate();
  if (!delegate) {
    throw new Error("offer_ideas_unsupported");
  }
  try {
    return await delegate.upsert({
      where: {
        userId_offerId: { userId, offerId },
      },
      create: { userId, offerId },
      update: {},
    });
  } catch (error) {
    if (isOfferIdeaTableMissing(error)) {
      throw new Error("offer_ideas_unsupported");
    }
    throw error;
  }
}

/** Удалить предложение из «Идей». */
export async function removeOfferIdea(userId: string, offerId: string): Promise<void> {
  const delegate = getOfferIdeaDelegate();
  if (!delegate) return;
  try {
    await delegate.deleteMany({
      where: { userId, offerId },
    });
  } catch (error) {
    if (isOfferIdeaTableMissing(error)) return;
    throw error;
  }
}

/** Проверить, сохранено ли предложение в «Идеях». */
export async function hasOfferIdea(userId: string, offerId: string): Promise<boolean> {
  const delegate = getOfferIdeaDelegate();
  if (!delegate) return false;
  try {
    const row = await delegate.findUnique({
      where: {
        userId_offerId: { userId, offerId },
      },
    });
    return row !== null;
  } catch (error) {
    if (isOfferIdeaTableMissing(error)) return false;
    throw error;
  }
}

/** Сохранить место в «Идеи» (idempotent). */
export async function addPlaceIdea(userId: string, placeId: string) {
  return prisma.placeIdea.upsert({
    where: {
      userId_placeId: { userId, placeId },
    },
    create: { userId, placeId },
    update: {},
  });
}

/** Удалить место из «Идей». */
export async function removePlaceIdea(userId: string, placeId: string): Promise<void> {
  await prisma.placeIdea.deleteMany({
    where: { userId, placeId },
  });
}

/** Проверить, сохранено ли место в «Идеях». */
export async function hasPlaceIdea(userId: string, placeId: string): Promise<boolean> {
  const row = await prisma.placeIdea.findUnique({
    where: {
      userId_placeId: { userId, placeId },
    },
  });
  return row !== null;
}

/** Сохранить статью в «Идеи» (idempotent). */
export async function addArticleIdea(userId: string, articleId: string) {
  return prisma.articleIdea.upsert({
    where: {
      userId_articleId: { userId, articleId },
    },
    create: { userId, articleId },
    update: {},
  });
}

/** Удалить статью из «Идей». */
export async function removeArticleIdea(userId: string, articleId: string): Promise<void> {
  await prisma.articleIdea.deleteMany({
    where: { userId, articleId },
  });
}

/** Проверить, сохранена ли статья в «Идеях». */
export async function hasArticleIdea(userId: string, articleId: string): Promise<boolean> {
  const row = await prisma.articleIdea.findUnique({
    where: {
      userId_articleId: { userId, articleId },
    },
  });
  return row !== null;
}

/**
 * Проверить, какие из переданных статей сохранены в «Идеях» — один запрос,
 * без N+1 (используется батч-статусом для карточек статей).
 */
export async function hasArticleIdeasBatch(
  userId: string,
  articleIds: string[],
): Promise<Set<string>> {
  if (articleIds.length === 0) return new Set();
  const rows = await prisma.articleIdea.findMany({
    where: { userId, articleId: { in: articleIds } },
    select: { articleId: true },
  });
  return new Set(rows.map((r) => r.articleId));
}
