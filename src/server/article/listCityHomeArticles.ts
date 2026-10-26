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
  excerpt?: string | null;
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
  updatedAt: Date;
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
} satisfies Prisma.ArticleSelect;

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
    excerpt: row.excerpt,
    subtitle: row.subtitle === BREAKING_NEWS_SUBTITLE ? null : row.subtitle,
    contentType: row.subtitle === BREAKING_NEWS_SUBTITLE ? "NEWS" : "ARTICLE",
    category: row.category
      ? { id: row.category.id, slug: row.category.slug, name: row.category.nameRu }
      : null,
    tags: row.tags.map(tag => ({ id: tag.id, slug: tag.slug, name: tag.title })),
    isBreakingNews: row.subtitle === BREAKING_NEWS_SUBTITLE,
    readTime: estimateReadTimeMinutes(extractArticlePlainText(row.contentJson, row.excerpt)),
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    coverImageUrl: row.coverImage?.publicUrl ?? row.heroImage ?? null,
  };
}

/**
 * Country-wide articles, grouped by primary relevance to the selected city.
 * The bucket counts preserve the exact same order across all paginated pages.
 */
export async function queryCityHomeArticles(
  city: CityHomeArticleCity,
  options: { skip?: number; take?: number; additionalWhere?: Prisma.ArticleWhereInput } = {},
): Promise<CityHomeJournalArticle[]> {
  const base: Prisma.ArticleWhereInput = options.additionalWhere
    ? { AND: [publicJournalWhere(), options.additionalWhere] }
    : publicJournalWhere();
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

/** Locations which actually contain public materials (not the entire geo directory). */
export type JournalLocationOption = {
  value: string;
  label: string;
  kind: "city" | "region" | "country";
};

export async function listJournalLocationOptions(): Promise<JournalLocationOption[]> {
  const rows = await prisma.article.findMany({
    where: publicJournalWhere(),
    distinct: ["geoScope", "cityId", "regionId"],
    select: {
      geoScope: true,
      city: { select: { slug: true, name: true, region: { select: { slug: true, name: true } } } },
      region: { select: { slug: true, name: true } },
    },
  });
  const options: JournalLocationOption[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const option = row.geoScope === "CITY" && row.city
      ? { value: `city:${row.city.slug}`, label: row.city.name, kind: "city" as const }
      : row.geoScope === "REGION" && row.region
        ? { value: `region:${row.region.slug}`, label: row.region.name, kind: "region" as const }
        : row.geoScope === "COUNTRY"
          ? { value: "country:belarus", label: "Беларусь", kind: "country" as const }
          : null;
    if (option && !seen.has(option.value)) {
      seen.add(option.value);
      options.push(option);
    }
    // A region includes its cities, so it is available even when no article
    // is directly assigned to the REGION geoScope.
    const relatedRegion = row.geoScope === "CITY" ? row.city?.region : null;
    if (relatedRegion) {
      const regionalOption = { value: `region:${relatedRegion.slug}`, label: relatedRegion.name, kind: "region" as const };
      if (!seen.has(regionalOption.value)) {
        seen.add(regionalOption.value);
        options.push(regionalOption);
      }
    }
  }
  return options.sort((a, b) => {
    const order = { city: 0, region: 1, country: 2 };
    return order[a.kind] - order[b.kind] || a.label.localeCompare(b.label, "ru");
  });
}

function journalLocationWhere(value: string | null): Prisma.ArticleWhereInput | null {
  if (!value) return null;
  const [kind, slug, extra] = value.split(":");
  if (extra || !slug || !/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  if (kind === "city") return { geoScope: "CITY", city: { is: { slug } } };
  if (kind === "region") {
    return {
      OR: [
        { geoScope: "REGION", region: { is: { slug } } },
        { geoScope: "CITY", city: { is: { region: { is: { slug } } } } },
      ],
    };
  }
  if (kind === "country" && slug === "belarus") return { geoScope: "COUNTRY" };
  return null;
}

/** Chronological journal list: changes to an article immediately affect its position. */
async function queryChronologicalJournal(
  options: { skip: number; take: number; location?: string | null },
): Promise<CityHomeJournalArticle[]> {
  const locationWhere = journalLocationWhere(options.location ?? null);
  const where: Prisma.ArticleWhereInput = locationWhere
    ? { AND: [publicJournalWhere(), locationWhere] }
    : publicJournalWhere();
  const rows = await prisma.article.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: options.skip,
    take: options.take,
    select: JOURNAL_SELECT,
  });
  return rows.map(row => toJournalArticle(row, null));
}

function journalPublicWhere(location?: string | null): Prisma.ArticleWhereInput {
  const scope = journalLocationWhere(location ?? null);
  return scope ? { AND: [publicJournalWhere(), scope] } : publicJournalWhere();
}

export async function listCityBlogArticles(
  _city: CityHomeArticleCity,
  page: number,
  pageSize = 24,
  location?: string | null,
): Promise<JournalPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.max(1, Math.min(60, Math.trunc(pageSize)));
  const total = await prisma.article.count({ where: journalPublicWhere(location) });
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const articles = safePage > totalPages ? [] : await queryChronologicalJournal({
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
    location,
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
  location?: string | null,
): Promise<JournalPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.max(1, Math.min(60, Math.trunc(pageSize)));
  const total = await prisma.article.count({ where: journalPublicWhere(location) });
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const articles = safePage > totalPages ? [] : await queryChronologicalJournal({
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
    location,
  });

  return { articles, page: safePage, pageSize: safePageSize, total, totalPages };
}
