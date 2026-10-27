import { EventCategoryPublicationType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import { notExpiredJournalPublicationWhere } from "@/lib/journal/publicationType";
import { queryCityHomeArticles, type JournalPage } from "@/server/article/listCityHomeArticles";

export type CityBlogCategory = {
  id: string;
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  hasNewArticle: boolean;
};

type CityRef = {
  id: string;
  slug: string;
  regionId?: string | null;
};

const PAGE_SIZE = 24;

function indexableArticleWhere(city: CityRef): Prisma.ArticleWhereInput {
  void city; // Geography is a relevance rank, not a barrier to discovery.
  return {
    ...getPublicPublishedArticleWhere(),
    noindex: false,
    slug: { not: null },
    publishedAt: { not: null },
    // SQL NOT ILIKE excludes NULL too; an unset robots override is indexable.
    // All published Belarusian articles remain discoverable in every city.
    AND: [{ OR: [
      { seoRobots: null },
      { NOT: { seoRobots: { contains: "noindex", mode: "insensitive" } } },
    ] }, notExpiredJournalPublicationWhere(new Date())],
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

  // One latest visible publication per section: works for both primary and
  // additional category assignments, independent of current journal pagination.
  const freshnessCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return Promise.all(categories.map(async (category) => {
    const latest = await prisma.article.findFirst({
      where: { AND: [articleWhere, categoryScopeWhere([category.id])] },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        publishedAt: true,
        heroImage: true,
        coverImage: { select: { publicUrl: true } },
      },
    });
    const recentCover = latest?.coverImage?.publicUrl ?? latest?.heroImage ?? null;
    const illustrated = recentCover ? null : await prisma.article.findFirst({
      where: {
        AND: [articleWhere, categoryScopeWhere([category.id])],
        OR: [
          { coverImage: { isNot: null } },
          { heroImage: { not: null } },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      select: { heroImage: true, coverImage: { select: { publicUrl: true } } },
    });
    return {
      id: category.id,
      slug: category.slug,
      name: category.nameRu,
      thumbnailUrl: recentCover ?? illustrated?.coverImage?.publicUrl ?? illustrated?.heroImage ?? null,
      hasNewArticle: Boolean(latest?.publishedAt && latest.publishedAt >= freshnessCutoff),
    };
  }));
}

export async function resolveCityBlogCategory(city: CityRef, slug: string) {
  void city;
  return prisma.eventCategory.findFirst({
    where: {
      slug,
      publicationType: EventCategoryPublicationType.ARTICLE,
      isActive: true,
      archivedAt: null,
    },
    select: {
      id: true,
      slug: true,
      nameRu: true,
      journalSeoTitle: true,
      journalSeoDescription: true,
      journalIntro: true,
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
    subcategories: children.map((child) => ({ id: child.id, slug: child.slug, name: child.nameRu, thumbnailUrl: null, hasNewArticle: false })),
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

/**
 * Фильтр рубрики для блоков журнала: индексируемые материалы рубрики (включая
 * подрубрики корня) и, опционально, тема. Используется всеми блоками страницы рубрики.
 */
export async function cityBlogCategoryScopeWhere(
  city: CityRef,
  categoryId: string,
  options: { tagSlug?: string | null } = {},
): Promise<Prisma.ArticleWhereInput> {
  const childRows = await prisma.eventCategory.findMany({
    where: { parentId: categoryId, isActive: true, archivedAt: null },
    select: { id: true },
  });
  const scopeIds = [categoryId, ...childRows.map((child) => child.id)];
  return {
    AND: [
      indexableArticleWhere(city),
      categoryScopeWhere(scopeIds),
      ...(options.tagSlug ? [{ tags: { some: { slug: options.tagSlug, isActive: true } } }] : []),
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
  const articles = safePage > totalPages
    ? []
    : await queryCityHomeArticles(city, {
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        additionalWhere: where,
      });

  return { articles, page: safePage, pageSize: safePageSize, total, totalPages };
}
