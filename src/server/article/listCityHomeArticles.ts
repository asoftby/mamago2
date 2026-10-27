import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { type JournalGeographyGroup } from "@/lib/article/articleJournalGeography";
import prisma from "@/lib/prisma";
import {
  buildCityPublicPath,
  buildNationalArticlePath,
} from "@/lib/routing/cityPaths";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import { buildJournalFeedBuckets, type JournalBucket } from "@/server/journal/journalPageQueries";
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
  excerpt?: string | null;
  subtitle: string | null;
  contentType: "ARTICLE" | "NEWS";
  /** Тип публикации журнала (ось формата; рубрика — category). */
  publicationType: "ARTICLE" | "COLLECTION" | "BREAKING_NEWS";
  featured: boolean;
  pinned: boolean;
  /** Число элементов подборки и сколько из них — события (для меты «10 мест/событий»). */
  collectionItemCount: number;
  collectionEventCount: number;
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
  updatedAt: Date;
  coverImageUrl: string | null;
};

export type { JournalDbRow };

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
  updatedAt: true,
  heroImage: true,
  coverImage: { select: { publicUrl: true } },
  category: { select: { id: true, slug: true, nameRu: true } },
  tags: {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" as const }, { title: "asc" as const }],
    select: { id: true, slug: true, title: true },
  },
  publicationType: true,
  featured: true,
  pinned: true,
  linkedItems: { select: { kind: true } },
} satisfies Prisma.ArticleSelect;

type JournalDbRow = Prisma.ArticleGetPayload<{ select: typeof JOURNAL_SELECT }>;

const JOURNAL_ORDER: Prisma.ArticleOrderByWithRelationInput[] = [
  { publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" },
];

/**
 * Публичные списки журнала: опубликовано, есть slug и дата. Истёкшие новости
 * остаются в лентах (с бейджем «Новость»); срок `expiresAt` отсекает их только
 * из блока «Новости» (см. journalBlockWheres).
 */
export function publicJournalWhere(): Prisma.ArticleWhereInput {
  return {
    ...getPublicPublishedArticleWhere(),
    slug: { not: null },
    publishedAt: { not: null },
  };
}

export function toJournalArticle(
  row: JournalDbRow,
  group: JournalGeographyGroup | null,
): CityHomeJournalArticle {
  const slug = row.slug!;
  const isNews = row.publicationType === "BREAKING_NEWS" || row.subtitle === BREAKING_NEWS_SUBTITLE;
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
    excerpt: row.excerpt,
    subtitle: row.subtitle === BREAKING_NEWS_SUBTITLE ? null : row.subtitle,
    contentType: isNews ? "NEWS" : "ARTICLE",
    publicationType: isNews ? "BREAKING_NEWS" : row.publicationType,
    featured: row.featured,
    pinned: row.pinned,
    collectionItemCount: row.linkedItems.length,
    collectionEventCount: row.linkedItems.filter((item) => item.kind === "EVENT").length,
    category: row.category
      ? { id: row.category.id, slug: row.category.slug, name: row.category.nameRu }
      : null,
    tags: row.tags.map(tag => ({ id: tag.id, slug: tag.slug, name: tag.title })),
    isBreakingNews: isNews,
    readTime: estimateReadTimeMinutes(extractArticlePlainText(row.contentJson, row.excerpt)),
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    coverImageUrl: row.coverImage?.publicUrl ?? row.heroImage ?? null,
  };
}


/**
 * Paginate across ordered buckets: each bucket is sorted by publication date,
 * bucket counts keep the order identical across pages.
 */
async function queryBucketedJournal(
  base: Prisma.ArticleWhereInput,
  buckets: JournalBucket[],
  options: { skip?: number; take?: number },
): Promise<CityHomeJournalArticle[]> {
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

/**
 * Country-wide articles, grouped by primary relevance to the selected city.
 * The bucket counts preserve the exact same order across all paginated pages.
 */
export async function queryCityHomeArticles(
  city: CityHomeArticleCity,
  options: { skip?: number; take?: number; additionalWhere?: Prisma.ArticleWhereInput } = {},
): Promise<CityHomeJournalArticle[]> {
  return queryJournalArticles(city, options);
}

/**
 * Journal listing used by every journal block: public + not-expired base,
 * optional extra filter, city relevance buckets, optional «pinned first».
 */
export async function queryJournalArticles(
  city: CityHomeArticleCity | null,
  options: {
    skip?: number;
    take?: number;
    additionalWhere?: Prisma.ArticleWhereInput;
    pinnedFirst?: boolean;
  } = {},
): Promise<CityHomeJournalArticle[]> {
  const base: Prisma.ArticleWhereInput = options.additionalWhere
    ? { AND: [publicJournalWhere(), options.additionalWhere] }
    : publicJournalWhere();
  return queryBucketedJournal(base, buildJournalFeedBuckets(city, options), options);
}

/** Total for {@link queryJournalArticles} with the same filter. */
export async function countJournalArticles(additionalWhere?: Prisma.ArticleWhereInput): Promise<number> {
  return prisma.article.count({
    where: additionalWhere ? { AND: [publicJournalWhere(), additionalWhere] } : publicJournalWhere(),
  });
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
