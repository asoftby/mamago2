import { Prisma } from "@prisma/client";

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Запись «старый сегмент URL → сущность»; при дубликате (повторный прогон) — no-op. */
export async function createActivitySlugHistoryIgnoreDuplicate(
  tx: Prisma.TransactionClient,
  activityId: string,
  slug: string,
): Promise<void> {
  try {
    await tx.activitySlugHistory.create({ data: { activityId, slug } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
}

export async function createPlaceSlugHistoryIgnoreDuplicate(
  tx: Prisma.TransactionClient,
  placeId: string,
  slug: string,
): Promise<void> {
  try {
    await tx.placeSlugHistory.create({ data: { placeId, slug } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
}

export async function createOfferSlugHistoryIgnoreDuplicate(
  tx: Prisma.TransactionClient,
  offerId: string,
  slug: string,
): Promise<void> {
  try {
    await tx.offerSlugHistory.create({ data: { offerId, slug } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
}

export async function createArticleSlugHistoryIgnoreDuplicate(
  tx: Prisma.TransactionClient,
  articleId: string,
  slug: string,
): Promise<void> {
  try {
    await tx.articleSlugHistory.create({ data: { articleId, slug } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
}

export async function createRouteSlugHistoryIgnoreDuplicate(
  tx: Prisma.TransactionClient,
  routeId: string,
  slug: string,
): Promise<void> {
  try {
    await tx.routeSlugHistory.create({ data: { routeId, slug } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
  }
}
