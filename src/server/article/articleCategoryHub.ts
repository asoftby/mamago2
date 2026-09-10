import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildCityPublicPath, buildNationalArticlePath } from "@/lib/routing/cityPaths";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { buildArticleCityDiscoveryWhere } from "@/lib/article/articleGeographyTargets";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";

export type ArticleCategoryHubCity = {
  id: string;
  slug: string;
  name: string;
  regionId?: string | null;
};

export type PublicArticleCategory = {
  id: string;
  slug: string;
  name: string;
};

export type ArticleCategoryHubItem = {
  id: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  href: string;
  publishedAt: Date | null;
  coverImageUrl: string | null;
};

export type ArticleCategoryHubPage = {
  category: PublicArticleCategory;
  articles: ArticleCategoryHubItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function articleDiscoveryWhere(city?: ArticleCategoryHubCity | null): Prisma.ArticleWhereInput {
  const base: Prisma.ArticleWhereInput = {
    ...getPublicPublishedArticleWhere(),
    noindex: false,
    slug: { not: null },
    publishedAt: { not: null },
  };

  if (!city) {
    return { ...base, geoScope: "COUNTRY" };
  }

  return {
    AND: [
      base,
      {
        OR: [
          ...(buildArticleCityDiscoveryWhere(city).OR ?? []),
          { subtitle: BREAKING_NEWS_SUBTITLE, geoScope: "COUNTRY" },
        ],
      },
    ],
  };
}

function categoryMembershipWhere(categoryId: string): Prisma.ArticleWhereInput {
  return {
    OR: [
      { categoryId },
      { additionalCategoryLinks: { some: { categoryId } } },
    ],
  };
}

export async function resolvePublicArticleCategory(
  slug: string,
): Promise<PublicArticleCategory | null> {
  const category = await prisma.eventCategory.findFirst({
    where: {
      slug: slug.trim().toLowerCase(),
      publicationType: "ARTICLE",
      parentId: null,
      isActive: true,
      archivedAt: null,
    },
    select: { id: true, slug: true, nameRu: true },
  });
  return category
    ? { id: category.id, slug: category.slug, name: category.nameRu }
    : null;
}

export async function listPublicArticleCategories(
  city?: ArticleCategoryHubCity | null,
): Promise<PublicArticleCategory[]> {
  const articles = await prisma.article.findMany({
    where: articleDiscoveryWhere(city),
    select: {
      categoryId: true,
      additionalCategoryLinks: { select: { categoryId: true } },
    },
  });

  const ids = new Set<string>();
  for (const article of articles) {
    if (article.categoryId) ids.add(article.categoryId);
    for (const link of article.additionalCategoryLinks) ids.add(link.categoryId);
  }
  if (ids.size === 0) return [];

  const categories = await prisma.eventCategory.findMany({
    where: {
      id: { in: [...ids] },
      publicationType: "ARTICLE",
      parentId: null,
      isActive: true,
      archivedAt: null,
    },
    orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
    select: { id: true, slug: true, nameRu: true },
  });

  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.nameRu,
  }));
}

export async function loadArticleCategoryHubPage(args: {
  categorySlug: string;
  city?: ArticleCategoryHubCity | null;
  page: number;
  pageSize?: number;
}): Promise<ArticleCategoryHubPage | null> {
  const category = await resolvePublicArticleCategory(args.categorySlug);
  if (!category) return null;

  const pageSize = Math.max(1, Math.min(60, Math.trunc(args.pageSize ?? 24)));
  const page = Math.max(1, Math.trunc(args.page));
  const where: Prisma.ArticleWhereInput = {
    AND: [articleDiscoveryWhere(args.city), categoryMembershipWhere(category.id)],
  };

  const total = await prisma.article.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages && total > 0) {
    return { category, articles: [], page, pageSize, total, totalPages };
  }

  const rows = await prisma.article.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      subtitle: true,
      excerpt: true,
      slug: true,
      geoScope: true,
      publishedAt: true,
      heroImage: true,
      coverImage: { select: { publicUrl: true } },
      city: { select: { slug: true } },
    },
  });

  const articles: ArticleCategoryHubItem[] = rows.flatMap((article) => {
    if (!article.slug) return [];
    const href =
      article.geoScope === "CITY" && article.city?.slug
        ? buildCityPublicPath({ citySlug: article.city.slug, type: "article", slug: article.slug })
        : buildNationalArticlePath(article.slug);
    return [{
      id: article.id,
      title: article.title,
      subtitle: article.subtitle === BREAKING_NEWS_SUBTITLE ? null : article.subtitle,
      excerpt: article.excerpt,
      href,
      publishedAt: article.publishedAt,
      coverImageUrl: article.coverImage?.publicUrl ?? article.heroImage ?? null,
    }];
  });

  return { category, articles, page, pageSize, total, totalPages };
}
