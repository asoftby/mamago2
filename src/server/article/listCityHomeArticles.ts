import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import {
  PUBLIC_ARTICLE_CATEGORY_DEPENDENCY_TAG,
  PUBLIC_ARTICLE_LIST_CACHE_TAG,
  PUBLIC_ARTICLE_LIST_REVALIDATE_SECONDS,
} from "@/server/article/publicArticleCache";

export type CityHomeJournalArticle = {
  id: string;
  slug: string;
  /** Pre-computed canonical public href (/{city}/blog/{slug} or /blog/{slug}) */
  href: string;
  title: string;
  subtitle: string | null;
  contentType: "ARTICLE" | "NEWS";
  category: {
    id: string;
    slug: string;
    name: string;
  } | null;
  tags: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  readTime: number;
  isBreakingNews: boolean;
  publishedAt: Date | null;
  coverImageUrl: string | null;
};

export type JournalPage = {
  articles: CityHomeJournalArticle[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type CityHomeArticleCity = {
  id: string;
  slug: string;
  name: string;
  regionId?: string | null;
};

/** City selection is context, never a restriction on Belarus-wide journal visibility. */
export function publicArticleJournalWhere(): Prisma.ArticleWhereInput {
  return {
    ...getPublicPublishedArticleWhere(),
    slug: { not: null },
    publishedAt: { not: null },
  };
}

const PUBLIC_ARTICLE_LIST_CACHE_TAGS = [
  PUBLIC_ARTICLE_LIST_CACHE_TAG,
  PUBLIC_ARTICLE_CATEGORY_DEPENDENCY_TAG,
];

function estimateReadTimeMinutes(text: string): number {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;

  if (words <= 0) return 3;
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

/**
 * Uncached DB projection used by the runtime cache wrapper, paginated journal,
 * and existing DB integration tests. The default remains the six-item homepage
 * feed; callers that need a real archive must pass skip/take explicitly.
 */
export async function queryCityHomeArticles(
  city: CityHomeArticleCity,
  options: { skip?: number; take?: number } = {},
): Promise<CityHomeJournalArticle[]> {
  void city;
  const rows = await prisma.article.findMany({
    where: publicArticleJournalWhere(),
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    skip: options.skip ?? 0,
    take: options.take ?? 6,
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

  return rows
    .filter((row): row is typeof row & { slug: string } => Boolean(row.slug) && (row.geoScope !== "CITY" || Boolean(row.city?.slug)))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      href: buildArticlePublicPath({
        slug: row.slug,
        geoScope: row.geoScope,
        citySlug: row.city?.slug,
      }),
      title: row.title,
      subtitle: row.subtitle === BREAKING_NEWS_SUBTITLE ? null : row.subtitle,
      contentType: row.subtitle === BREAKING_NEWS_SUBTITLE ? "NEWS" : "ARTICLE",
      category: row.category
        ? {
            id: row.category.id,
            slug: row.category.slug,
            name: row.category.nameRu,
          }
        : null,
      tags: row.tags.map((tag) => ({
        id: tag.id,
        slug: tag.slug,
        name: tag.title,
      })),
      isBreakingNews: row.subtitle === BREAKING_NEWS_SUBTITLE,
      readTime: estimateReadTimeMinutes(extractArticlePlainText(row.contentJson, row.excerpt)),
      publishedAt: row.publishedAt,
      coverImageUrl: row.coverImage?.publicUrl ?? row.heroImage ?? null,
    }));
}

export async function listCityHomeArticles(
  city: CityHomeArticleCity,
): Promise<CityHomeJournalArticle[]> {
  return unstable_cache(
    () => queryCityHomeArticles(city),
    ["public-article-list:city", city.id, city.slug, city.regionId ?? ""],
    {
      tags: PUBLIC_ARTICLE_LIST_CACHE_TAGS,
      revalidate: PUBLIC_ARTICLE_LIST_REVALIDATE_SECONDS,
    },
  )();
}

export async function listCityBlogArticles(
  city: CityHomeArticleCity,
  page: number,
  pageSize = 24,
): Promise<JournalPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.max(1, Math.min(60, Math.trunc(pageSize)));
  const where = publicArticleJournalWhere();

  const total = await prisma.article.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const articles =
    safePage > totalPages
      ? []
      : await queryCityHomeArticles(city, {
          skip: (safePage - 1) * safePageSize,
          take: safePageSize,
        });

  return { articles, page: safePage, pageSize: safePageSize, total, totalPages };
}

async function queryNationalBlogArticles(
  options: { skip?: number; take?: number } = {},
): Promise<CityHomeJournalArticle[]> {
  const rows = await prisma.article.findMany({
    where: publicArticleJournalWhere(),
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    skip: options.skip ?? 0,
    take: options.take ?? 100,
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

  return rows
    .filter((row): row is typeof row & { slug: string } => Boolean(row.slug) && (row.geoScope !== "CITY" || Boolean(row.city?.slug)))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      href: buildArticlePublicPath({
        slug: row.slug,
        geoScope: row.geoScope,
        citySlug: row.city?.slug,
      }),
      title: row.title,
      subtitle: row.subtitle === BREAKING_NEWS_SUBTITLE ? null : row.subtitle,
      contentType: row.subtitle === BREAKING_NEWS_SUBTITLE ? "NEWS" : "ARTICLE",
      category: row.category
        ? {
            id: row.category.id,
            slug: row.category.slug,
            name: row.category.nameRu,
          }
        : null,
      tags: row.tags.map((tag) => ({
        id: tag.id,
        slug: tag.slug,
        name: tag.title,
      })),
      isBreakingNews: row.subtitle === BREAKING_NEWS_SUBTITLE,
      readTime: estimateReadTimeMinutes(extractArticlePlainText(row.contentJson, row.excerpt)),
      publishedAt: row.publishedAt,
      coverImageUrl: row.coverImage?.publicUrl ?? row.heroImage ?? null,
    }));
}

/** /blog lists all published Belarus articles using each article's canonical URL. */
export async function listNationalBlogArticles(): Promise<CityHomeJournalArticle[]> {
  return unstable_cache(queryNationalBlogArticles, ["public-article-list:national"], {
    tags: PUBLIC_ARTICLE_LIST_CACHE_TAGS,
    revalidate: PUBLIC_ARTICLE_LIST_REVALIDATE_SECONDS,
  })();
}

export async function listNationalBlogArticlesPage(
  page: number,
  pageSize = 24,
): Promise<JournalPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.max(1, Math.min(60, Math.trunc(pageSize)));
  const total = await prisma.article.count({
    where: publicArticleJournalWhere(),
  });
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const articles =
    safePage > totalPages
      ? []
      : await queryNationalBlogArticles({
          skip: (safePage - 1) * safePageSize,
          take: safePageSize,
        });

  return { articles, page: safePage, pageSize: safePageSize, total, totalPages };
}
