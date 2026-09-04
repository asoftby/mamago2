import "server-only";

import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";
import {
  buildCityPublicPath,
  buildNationalArticlePath,
} from "@/lib/routing/cityPaths";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import { buildArticleCityDiscoveryWhere } from "@/lib/article/articleGeographyTargets";
import {
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
          return block.text;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");

  return [excerpt ?? "", blockText].filter(Boolean).join(" ");
}

export async function listCityHomeArticles(city: {
  id: string;
  slug: string;
  name: string;
  regionId?: string | null;
}): Promise<CityHomeJournalArticle[]> {
  const load = async (): Promise<CityHomeJournalArticle[]> => {
    const rows = await prisma.article.findMany({
      where: {
        ...getPublicPublishedArticleWhere(),
        slug: { not: null },
        publishedAt: { not: null },
        OR: [
          ...(buildArticleCityDiscoveryWhere(city).OR ?? []),
          // Breaking news: country-scope articles shown on every city home
          { subtitle: BREAKING_NEWS_SUBTITLE, geoScope: "COUNTRY" },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take: 6,
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
      .filter((row): row is typeof row & { slug: string } => Boolean(row.slug))
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        href:
          row.geoScope === "CITY"
            ? buildCityPublicPath({ citySlug: row.city?.slug ?? city.slug, type: "article", slug: row.slug })
            : buildNationalArticlePath(row.slug),
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
  };

  return unstable_cache(
    load,
    ["public-article-list:city", city.id, city.slug, city.regionId ?? ""],
    {
      tags: [PUBLIC_ARTICLE_LIST_CACHE_TAG],
      revalidate: PUBLIC_ARTICLE_LIST_REVALIDATE_SECONDS,
    },
  )();
}

/**
 * National journal listing for /blog. Only COUNTRY-scoped published articles
 * belong here; city/region materials keep their own canonical discovery paths.
 */
export async function listNationalBlogArticles(): Promise<CityHomeJournalArticle[]> {
  const load = async (): Promise<CityHomeJournalArticle[]> => {
    const rows = await prisma.article.findMany({
      where: {
        ...getPublicPublishedArticleWhere(),
        geoScope: "COUNTRY",
        slug: { not: null },
        publishedAt: { not: null },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
      select: {
        id: true,
        slug: true,
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
      .filter((row): row is typeof row & { slug: string } => Boolean(row.slug))
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        href: buildNationalArticlePath(row.slug),
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
  };

  return unstable_cache(load, ["public-article-list:national"], {
    tags: [PUBLIC_ARTICLE_LIST_CACHE_TAG],
    revalidate: PUBLIC_ARTICLE_LIST_REVALIDATE_SECONDS,
  })();
}
