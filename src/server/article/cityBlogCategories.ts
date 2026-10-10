import { EventCategoryPublicationType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildArticleCityDiscoveryWhere } from "@/lib/article/articleGeographyTargets";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
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

function extractArticlePlainText(raw: unknown, excerpt: string | null): string {
  const content = parseArticleContentJson(raw);
  const blockText = content.blocks
    .map((block) => {
      switch (block.type) {
        case "intro":
        case "quote":
        case "heading":
        case "text":
        case "callout":
          return block.text;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");
  return [excerpt ?? "", blockText].filter(Boolean).join(" ");
}

function indexableArticleWhere(city: CityRef): Prisma.ArticleWhereInput {
  return {
    ...getPublicPublishedArticleWhere(),
    noindex: false,
    slug: { not: null },
    publishedAt: { not: null },
    NOT: { seoRobots: { contains: "noindex", mode: "insensitive" } },
    ...buildArticleCityDiscoveryWhere(city, true),
  };
}

export async function listPopulatedCityBlogCategories(city: CityRef): Promise<CityBlogCategory[]> {
  const articleWhere = indexableArticleWhere(city);
  const categories = await prisma.eventCategory.findMany({
    where: {
      publicationType: EventCategoryPublicationType.ARTICLE,
      isActive: true,
      archivedAt: null,
      OR: [
        { articles: { some: articleWhere } },
        { articleAdditionalLinks: { some: { article: articleWhere } } },
      ],
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
  const articleWhere = indexableArticleWhere(city);
  return prisma.eventCategory.findFirst({
    where: {
      slug,
      publicationType: EventCategoryPublicationType.ARTICLE,
      isActive: true,
      archivedAt: null,
      OR: [
        { articles: { some: articleWhere } },
        { articleAdditionalLinks: { some: { article: articleWhere } } },
        // Корневая категория без собственных материалов, но с материалами в подкатегориях.
        { children: { some: { articles: { some: articleWhere } } } },
      ],
    },
    select: {
      id: true,
      slug: true,
      nameRu: true,
      parentId: true,
      parent: { select: { slug: true, nameRu: true } },
    },
  });
}

export type CityBlogCategoryFacets = {
  /** Корень ветки: сама категория или её родитель. */
  root: { slug: string; name: string };
  subcategories: CityBlogCategory[];
  tags: Array<{ id: string; slug: string; name: string }>;
};

/** Подкатегории ветки и темы (теги) материалов выбранной категории. */
export async function listCityBlogCategoryFacets(
  city: CityRef,
  category: { id: string; slug: string; nameRu: string; parentId: string | null; parent: { slug: string; nameRu: string } | null },
): Promise<CityBlogCategoryFacets> {
  const articleWhere = indexableArticleWhere(city);
  const rootId = category.parentId ?? category.id;
  const root = category.parent
    ? { slug: category.parent.slug, name: category.parent.nameRu }
    : { slug: category.slug, name: category.nameRu };

  const children = await prisma.eventCategory.findMany({
    where: {
      parentId: rootId,
      publicationType: EventCategoryPublicationType.ARTICLE,
      isActive: true,
      archivedAt: null,
      OR: [
        { articles: { some: articleWhere } },
        { articleAdditionalLinks: { some: { article: articleWhere } } },
      ],
    },
    select: { id: true, slug: true, nameRu: true },
    orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
  });

  // Корень показывает темы всей ветки, подкатегория — только свои.
  const scopeIds = category.parentId ? [category.id] : [category.id, ...children.map((child) => child.id)];
  const tags = await prisma.discoveryTag.findMany({
    where: {
      isActive: true,
      articles: { some: { AND: [articleWhere, categoryScopeWhere(scopeIds)] } },
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { id: true, slug: true, title: true },
  });

  return {
    root,
    subcategories: children.map((child) => ({ id: child.id, slug: child.slug, name: child.nameRu })),
    tags: tags.map((tag) => ({ id: tag.id, slug: tag.slug, name: tag.title })),
  };
}

function categoryScopeWhere(categoryIds: string[]): Prisma.ArticleWhereInput {
  return {
    OR: [
      { categoryId: { in: categoryIds } },
      { additionalCategoryLinks: { some: { categoryId: { in: categoryIds } } } },
    ],
  };
}

export async function listCityBlogCategoryArticles(
  city: CityRef,
  categoryId: string,
  page: number,
  pageSize = PAGE_SIZE,
  options: { tagSlug?: string | null } = {},
): Promise<JournalPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.max(1, Math.min(60, Math.trunc(pageSize)));
  // Корневая категория включает материалы своих подкатегорий.
  const childRows = await prisma.eventCategory.findMany({
    where: { parentId: categoryId, isActive: true, archivedAt: null },
    select: { id: true },
  });
  const scopeIds = [categoryId, ...childRows.map((child) => child.id)];
  const where: Prisma.ArticleWhereInput = {
    AND: [
      indexableArticleWhere(city),
      categoryScopeWhere(scopeIds),
      ...(options.tagSlug ? [{ tags: { some: { slug: options.tagSlug, isActive: true } } }] : []),
    ],
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
          contentJson: true,
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
    .map((row) => ({
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
      readTime: estimateReadTimeMinutes(extractArticlePlainText(row.contentJson, row.excerpt)),
      isBreakingNews: row.subtitle === BREAKING_NEWS_SUBTITLE,
      publishedAt: row.publishedAt,
      coverImageUrl: row.coverImage?.publicUrl ?? row.heroImage ?? null,
    }));

  return { articles, page: safePage, pageSize: safePageSize, total, totalPages };
}
