import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { buildJournalGeographyBuckets, type JournalGeographyGroup } from "@/lib/article/articleJournalGeography";
import prisma from "@/lib/prisma";
import {
  buildCityPublicPath,
  buildNationalArticlePath,
} from "@/lib/routing/cityPaths";
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
  /** Original publication geography, independent of the reader\u0027s selected city. */
  geographyLabel: string;
  geographyGroup: JournalGeographyGroup | null;
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

/** All journal listings use real canonical URLs, never the reader's selected city. */
const JOURNAL_SELECT = {
  id: true,
  slug: true,
  geoScope: true,
  city: { select: { slug: true, name: true } },
  region: { select: { name: true } },
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
} as const satisfies Prisma.ArticleSelect;

type JournalDbRow = Prisma.ArticleGetPayload<{ select: typeof JOURNAL_SELECT }>;

const JOURNAL_ORDER: Prisma.ArticleOrderByWithRelationInput[] = [
  { publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" },
];

function publicJournalWhere(): Prisma.ArticleWhereInput {
  return {
    ...getPublicPublishedArticleWhere(),
    slug: { not: null },
    publishedAt: { not: null },
  };
}

function toJournalArticle(
  row: JournalDbRow,
  group: JournalGeographyGroup | null,
): CityHomeJournalArticle {
  const slug = row.slug!;
  return {
    id: row.id,
    slug,
    href: row.geoScope === "CITY" && row.city?.slug
      ? buildCityPublicPath({ citySlug: row.city.slug, type: "article", slug })
      : buildNationalArticlePath(slug),
    geographyLabel: row.geoScope === "CITY"
      ? row.city?.name ?? "Город не указан"
      : row.geoScope === "REGION"
        ? row.region?.name ?? "Регион"
        : "Беларусь",
    geographyGroup: group,
    title: row.title,
    subtitle: row.subtitle === BREAKING_NEWS_SUBTITLE ? null : row.subtitle,
    contentType: row.subtitle === BREAKING_NEWS_SUBTITLE ? "NEWS" : "ARTICLE",
    category: row.category
      ? { id: row.category.id, slug: row.category.slug, name: row.category.nameRu }
      : null,
    tags: row.tags.map(tag => ({ id: tag.id, slug: tag.slug, name: tag.title })),
    isBreakingNews: row.subtitle === BREAKING_NEWS_SUBTITLE,
    readTime: estimateReadTimeMinutes(extractArticlePlainText(row.contentJson, row.excerpt)),
    publishedAt: row.publishedAt,
    coverImageUrl: row.coverImage?.publicUrl ?? row.heroImage ?? null,
  };
}

/**
 * Country-wide articles, grouped by primary relevance to the selected city.
 * The bucket counts preserve the exact same order across all paginated pages.
 */
export async function queryCityHomeArticles(
  city: CityHomeArticleCity,
  options: { skip?: number; take?: number } = {},
): Promise<CityHomeJournalArticle[]> {
  const base = publicJournalWhere();
  const buckets = buildJournalGeographyBuckets(city);
  const counts = await Promise.all(buckets.map(bucket =>
    prisma.article.count({ where: { AND: [base, bucket.where] } }),
  ));
  let skip = Math.max(0, options.skip ?? 0);
  let remaining = Math.max(0, options.take ?? 6);
  const articles: CityHomeJournalArticle[] = [];

  for (const [index, bucket] of buckets.entries()) {
    if (remaining === 0) break;
    const count = counts[index];
    if (skip >= count) {
      skip -= count;
      continue;
    }
    const take = Math.min(remaining, count - skip);
    const rows = await prisma.article.findMany({
      where: { AND: [base, bucket.where] },
      orderBy: JOURNAL_ORDER,
      skip,
      take,
      select: JOURNAL_SELECT,
    });
    articles.push(...rows.map(row => toJournalArticle(row, bucket.group)));
    remaining -= rows.length;
    skip = 0;
  }
  return articles;
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
  const total = await prisma.article.count({ where: publicJournalWhere() });
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
    where: publicJournalWhere(),
    orderBy: JOURNAL_ORDER,
    skip: options.skip ?? 0,
    take: options.take ?? 100,
    select: JOURNAL_SELECT,
  });
  return rows.map(row => toJournalArticle(row, null));
}

/**
 * National journal /blog: every published article across Belarus, newest first.
 */
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
  const total = await prisma.article.count({ where: publicJournalWhere() });
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
