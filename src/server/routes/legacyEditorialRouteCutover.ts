import type { PrismaClient } from "@prisma/client";
import {
  getLegacyEditorialRouteArticlePath,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG,
} from "@/lib/routes/legacyEditorialRouteCutover";

export async function resolveReadyLegacyEditorialRouteArticlePath(
  db: PrismaClient,
  slug: string | null | undefined,
): Promise<string | null> {
  const targetPath = getLegacyEditorialRouteArticlePath(slug);
  if (!targetPath || !slug) return null;

  const article = await db.article.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      geoScope: "CITY",
      noindex: false,
      city: { slug: LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG },
    },
    select: {
      id: true,
      category: {
        select: {
          nameRu: true,
          publicationType: true,
          isActive: true,
          archivedAt: true,
        },
      },
    },
  });

  if (
    !article ||
    article.category?.nameRu !== LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME ||
    article.category.publicationType !== "ARTICLE" ||
    !article.category.isActive ||
    article.category.archivedAt
  ) {
    return null;
  }

  return targetPath;
}
