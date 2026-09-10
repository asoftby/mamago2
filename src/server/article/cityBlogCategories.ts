import { EventCategoryPublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildArticleCityDiscoveryWhere } from "@/lib/article/articleGeographyTargets";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import type { CityHomeJournalArticle, JournalPage } from "@/server/article/listCityHomeArticles";

export type CityBlogCategory = {
  id: string;
  slug: string;
  name: string;
};

type CityRef = {
  id: string;
  slug: string;
  regionId?: string | null;
};

const PAGE_SIZE = 24;

function estimateReadTimeMinutes(text: string): number {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
  return Math.max(3, Math.ceil(words / 180));
}

export async function listPopulatedCityBlogCategories(city: CityRef): Promise<CityBlogCategory[]> {
  const categories = await prisma.eventCategory.findMany({
    where: {
      publicationType: EventCategoryPublicationType.ARTICLE,
      isActive: true,
      archivedAt: null,
      articles: {
        some: {
          ...getPublicPublishedArticleWhere(),
          noindex: false,
          ...buildArticleCityDiscoveryWhere(city, true),
        },
      },
    },
    select: { id: true, slug: true, nameRu: true },
    orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
  });

  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.nameRu,
  }));
}

export async function resolveCityBlogCategory(city: CityRef, slug: string) {
  return prisma.eventCategory.findFirst({
    where: {
      slug,
      publicationType: EventCategoryPublicationType.ARTICLE,
      isActive: true,
      archivedAt: null,
      articles: {
        some: {
          ...getPublicPublishedArticleWhere(),
          noindex: false,
          ...buildArticleCityDiscoveryWhere(city, true),
        },
      },
    },
    select: { id: true, slug: true, nameRu: true },
  });
}

export async function listCityBlogCategoryArticles(
  city: CityRef,
  categoryId: string,
  page: number,
  pageSize = PAGE_SIZE,
): Promise<JournalPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.max(1, Math.min(60, Math.trunc(pageSize)));
  const where = {
    ...getPublicPublishedArticleWhere(),
    noindex: false,
    slug: { not: null },
    publishedAt: { not: null },
    categoryId,
    ...buildArticleCityDiscoveryWhere(city, true),
  };

  const total = await prisma.article.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const rows = safePage > totalPages
    ? []
    : await prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        select: {
          id: true,
          slug: true,
          geoScope: true,
          city: { select: { slug: true } },
          title: true,
          subtitle: true,
          excerpt: true,
          publishedAt: true,
          heroImage: true,
          coverImage: { select: { publicUrl: true } },
          category: { select: { id: true, slug: true, nameRu: true } },
          tags: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
            select: { id: true, slug: true, title: true },
          },
        },
      });

  const articles: CityHomeJournalArticle[] = rows
    .filter((row): row is typeof row & { slug: string } => Boolean(row.slug))
    .map((row) => {
      const plainText = [row.excerpt ?? "", row.title, row.subtitle ?? ""].join(" ");
      return {
        id: row.id,
        slug: row.slug,
        href: buildArticlePublicPath({
          slug: row.slug,
          geoScope: row.geoScope,
          citySlug: row.city?.slug ?? city.slug,
        }),
        title: row.title,
        subtitle: row.subtitle === BREAKING_NEWS_SUBTITLE ? null : row.subtitle,
        contentType: row.subtitle === BREAKING_NEWS_SUBTITLE ? "NEWS" : "ARTICLE",
        category: row.category
          ? { id: row.category.id, slug: row.category.slug, name: row.category.nameRu }
          : null,
        tags: row.tags.map((tag) => ({ id: tag.id, slug: tag.slug, name: tag.title })),
        readTime: estimateReadTimeMinutes(plainText),
        isBreakingNews: row.subtitle === BREAKING_NEWS_SUBTITLE,
        publishedAt: row.publishedAt,
        coverImageUrl: row.coverImage?.publicUrl ?? row.heroImage ?? null,
      };
    });

  return { articles, page: safePage, pageSize: safePageSize, total, totalPages };
}
