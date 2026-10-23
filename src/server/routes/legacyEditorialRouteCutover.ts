import type { PrismaClient } from "@prisma/client";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import { DEFAULT_COUNTRY_ISO } from "@/server/geo/geoConstants";
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

  // Keep data migration and public cutover separate. A target Article can be
  // fully ready while the legacy source is still retained as DRAFT/PUBLISHED;
  // redirect/search retirement becomes active only after the guarded cutover
  // archives that exact editorial Route.
  const sourceRoute = await db.route.findFirst({
    where: {
      slug,
      authorId: null,
      status: "ARCHIVED",
    },
    select: { id: true },
  });
  if (!sourceRoute) return null;

  const article = await db.article.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      geoScope: "CITY",
      noindex: false,
      city: {
        slug: LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG,
        isActive: true,
        isLegacyNonCity: false,
        country: { isoCode: DEFAULT_COUNTRY_ISO },
      },
      OR: [
        { seoRobots: null },
        { NOT: { seoRobots: { contains: "noindex", mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      contentJson: true,
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
    parseArticleContentJson(article.contentJson).blocks.length === 0 ||
    article.category?.nameRu !== LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME ||
    article.category.publicationType !== "ARTICLE" ||
    !article.category.isActive ||
    article.category.archivedAt
  ) {
    return null;
  }

  return targetPath;
}
