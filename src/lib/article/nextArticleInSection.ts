/**
 * Подбор следующей статьи внутри настоящего раздела журнала (`Article.categoryId`).
 * Без персонализации: детерминированный порядок publishedAt DESC, id DESC.
 */
import { Prisma, type GeoScope } from "@prisma/client";
import prisma from "@/lib/prisma";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import {
  buildArticleMvpResolvedBlocks,
  type ArticleMvpResolvedBlock,
} from "@/lib/article/articleMvpRenderData";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";
import {
  buildNextArticleInSectionWhere,
  MAX_NEXT_ARTICLE_EXCLUDE_IDS,
  NEXT_ARTICLE_ORDER_BY,
  normalizeExcludeIds,
} from "@/lib/article/nextArticleInSectionQuery";

export {
  buildNextArticleInSectionWhere,
  MAX_NEXT_ARTICLE_EXCLUDE_IDS,
  NEXT_ARTICLE_ORDER_BY,
  normalizeExcludeIds,
} from "@/lib/article/nextArticleInSectionQuery";

export type NextArticleSectionRef = {
  id: string;
  slug: string;
  name: string;
};

export type PublicContinuousArticleDto = {
  id: string;
  slug: string;
  href: string;
  title: string;
  excerpt: string | null;
  subtitle: string | null;
  publishedAt: string | null;
  documentTitle: string;
  heroUrl: string | null;
  heroAlt: string | null;
  readTimeMinutes: number;
  categoryLabel: string | null;
  section: NextArticleSectionRef | null;
  tags: Array<{ slug: string; title: string }>;
  blocks: ArticleMvpResolvedBlock[];
  geoScope: GeoScope;
  cityId: string | null;
};

export type FindNextArticleInSectionInput = {
  currentArticleId: string;
  sectionId: string;
  cityId: string | null;
  geoScope: GeoScope;
  excludeIds: string[];
  /** Для тестов / clock injection */
  now?: Date;
};

export type FindNextArticleInSectionResult = {
  article: PublicContinuousArticleDto | null;
  exhausted: boolean;
};

const nextArticleSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  subtitle: true,
  publishedAt: true,
  contentJson: true,
  heroImage: true,
  seoOgImage: true,
  seoTitle: true,
  geoScope: true,
  cityId: true,
  categoryId: true,
  category: {
    select: {
      id: true,
      slug: true,
      nameRu: true,
    },
  },
  city: {
    select: { slug: true },
  },
  tags: {
    where: { isActive: true },
    select: { slug: true, title: true },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

async function fetchCoverPublicUrl(articleId: string): Promise<{
  publicUrl: string | null;
  alt: string | null;
} | null> {
  try {
    const r = await prisma.$queryRaw<Array<{ coverImageId: string | null }>>(
      Prisma.sql`SELECT "coverImageId" FROM "Article" WHERE id = ${articleId} LIMIT 1`,
    );
    const coverImageId = r[0]?.coverImageId ?? null;
    if (!coverImageId) return null;
    return prisma.mediaAsset.findUnique({
      where: { id: coverImageId },
      select: { publicUrl: true, alt: true },
    });
  } catch {
    return null;
  }
}

function estimateReadTimeMinutes(blocks: ArticleMvpResolvedBlock[]): number {
  let chars = 0;
  for (const b of blocks) {
    if (b.type === "text" || b.type === "intro" || b.type === "quote") {
      chars += b.text.replace(/<[^>]+>/g, " ").length;
    } else if (b.type === "heading") {
      chars += b.text.length;
    }
  }
  const words = Math.max(1, Math.round(chars / 5));
  return Math.max(1, Math.min(60, Math.ceil(words / 200)));
}

export async function mapRowToPublicContinuousArticleDto(
  row: {
    id: string;
    slug: string | null;
    title: string;
    excerpt: string | null;
    subtitle: string | null;
    publishedAt: Date | null;
    contentJson: unknown;
    heroImage: string | null;
    seoOgImage: string | null;
    seoTitle: string | null;
    geoScope: GeoScope | null;
    cityId: string | null;
    categoryId: string | null;
    category: { id: string; slug: string; nameRu: string } | null;
    city: { slug: string } | null;
    tags: Array<{ slug: string; title: string }>;
  },
): Promise<PublicContinuousArticleDto | null> {
  if (!row.slug || !row.geoScope) return null;
  const content = parseArticleContentJson(row.contentJson);
  if (content.blocks.length === 0) return null;
  const blocks = await buildArticleMvpResolvedBlocks(content.blocks);
  const cover = await fetchCoverPublicUrl(row.id);
  const heroUrl = cover?.publicUrl ?? row.heroImage ?? row.seoOgImage ?? null;
  const href = buildArticlePublicPath({
    slug: row.slug,
    geoScope: row.geoScope,
    citySlug: row.city?.slug ?? null,
  });
  const section =
    row.category && row.categoryId
      ? {
          id: row.category.id,
          slug: row.category.slug,
          name: row.category.nameRu,
        }
      : null;

  return {
    id: row.id,
    slug: row.slug,
    href,
    title: row.title,
    excerpt: row.excerpt,
    subtitle: row.subtitle,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    documentTitle: row.seoTitle?.trim() || `${row.title} — mamaGo`,
    heroUrl,
    heroAlt: cover?.alt ?? row.title,
    readTimeMinutes: estimateReadTimeMinutes(blocks),
    categoryLabel: row.category?.nameRu ?? null,
    section,
    tags: row.tags,
    blocks,
    geoScope: row.geoScope,
    cityId: row.cityId,
  };
}

/**
 * Загружает следующую опубликованную статью того же раздела.
 * Не доверяет клиенту: заново проверяет visibility текущего и кандидата.
 */
export async function findNextArticleInSection(
  input: FindNextArticleInSectionInput,
): Promise<FindNextArticleInSectionResult> {
  const now = input.now ?? new Date();
  const excludeIds = normalizeExcludeIds(input.excludeIds, input.currentArticleId);

  const current = await prisma.article.findFirst({
    where: {
      id: input.currentArticleId,
      status: "PUBLISHED",
      categoryId: input.sectionId,
      geoScope: input.geoScope,
      cityId: input.cityId === null ? null : input.cityId,
      publishedAt: { lte: now, not: null },
      slug: { not: null },
      OR: [{ subtitle: null }, { subtitle: { not: BREAKING_NEWS_SUBTITLE } }],
    },
    select: { id: true, categoryId: true, geoScope: true, cityId: true },
  });

  if (!current?.categoryId || !current.geoScope) {
    return { article: null, exhausted: true };
  }

  // Клиент мог подменить sectionId/city — используем значения из проверенной текущей статьи.
  const sectionId = current.categoryId;
  const geoScope = current.geoScope;
  const cityId = current.cityId;

  const candidate = await prisma.article.findFirst({
    where: buildNextArticleInSectionWhere({
      sectionId,
      cityId,
      geoScope,
      excludeIds,
      now,
    }),
    orderBy: NEXT_ARTICLE_ORDER_BY,
    select: nextArticleSelect,
  });

  if (!candidate) {
    return { article: null, exhausted: true };
  }

  const article = await mapRowToPublicContinuousArticleDto(candidate);
  if (!article) {
    // Кандидат есть, но контент пустой — считаем exhausted, чтобы не крутить retry на битый row.
    return { article: null, exhausted: true };
  }

  return { article, exhausted: false };
}

export type NextArticlePreviewDto = {
  id: string;
  slug: string;
  href: string;
  title: string;
  excerpt: string | null;
  heroUrl: string | null;
  heroAlt: string | null;
  readTimeMinutes: number;
  documentTitle: string;
};

const nextArticlePreviewSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  heroImage: true,
  seoOgImage: true,
  seoTitle: true,
  geoScope: true,
  cityId: true,
  city: { select: { slug: true } },
} as const;

/**
 * Лёгкий preview следующей статьи для SSR (crawlable `<a>` без полного body в HTML).
 */
export async function findNextArticlePreviewInSection(
  input: FindNextArticleInSectionInput,
): Promise<{ preview: NextArticlePreviewDto | null; exhausted: boolean }> {
  const now = input.now ?? new Date();
  const excludeIds = normalizeExcludeIds(input.excludeIds, input.currentArticleId);

  const current = await prisma.article.findFirst({
    where: {
      id: input.currentArticleId,
      status: "PUBLISHED",
      categoryId: input.sectionId,
      geoScope: input.geoScope,
      cityId: input.cityId === null ? null : input.cityId,
      publishedAt: { lte: now },
      slug: { not: null },
      OR: [{ subtitle: null }, { subtitle: { not: BREAKING_NEWS_SUBTITLE } }],
    },
    select: { id: true, categoryId: true, geoScope: true, cityId: true },
  });

  if (!current?.categoryId || !current.geoScope) {
    return { preview: null, exhausted: true };
  }

  const candidate = await prisma.article.findFirst({
    where: buildNextArticleInSectionWhere({
      sectionId: current.categoryId,
      cityId: current.cityId,
      geoScope: current.geoScope,
      excludeIds,
      now,
    }),
    orderBy: NEXT_ARTICLE_ORDER_BY,
    select: nextArticlePreviewSelect,
  });

  if (!candidate?.slug || !candidate.geoScope) {
    return { preview: null, exhausted: true };
  }

  const cover = await fetchCoverPublicUrl(candidate.id);
  const href = buildArticlePublicPath({
    slug: candidate.slug,
    geoScope: candidate.geoScope,
    citySlug: candidate.city?.slug ?? null,
  });

  return {
    preview: {
      id: candidate.id,
      slug: candidate.slug,
      href,
      title: candidate.title,
      excerpt: candidate.excerpt,
      heroUrl: cover?.publicUrl ?? candidate.heroImage ?? candidate.seoOgImage ?? null,
      heroAlt: cover?.alt ?? candidate.title,
      readTimeMinutes: 5,
      documentTitle: candidate.seoTitle?.trim() || `${candidate.title} — mamaGo`,
    },
    exhausted: false,
  };
}

/** Контекст раздела для seed первой SSR-статьи (если category есть). */
export async function loadArticleContinuousContext(articleId: string): Promise<{
  section: NextArticleSectionRef | null;
  geoScope: GeoScope | null;
  cityId: string | null;
  citySlug: string | null;
  enabled: boolean;
} | null> {
  const row = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      status: true,
      subtitle: true,
      geoScope: true,
      cityId: true,
      categoryId: true,
      category: { select: { id: true, slug: true, nameRu: true, archivedAt: true, isActive: true } },
      city: { select: { slug: true } },
    },
  });
  if (!row) return null;

  const isBreaking = row.subtitle === BREAKING_NEWS_SUBTITLE;
  const section =
    row.categoryId && row.category && !row.category.archivedAt && row.category.isActive
      ? {
          id: row.category.id,
          slug: row.category.slug,
          name: row.category.nameRu,
        }
      : null;

  return {
    section,
    geoScope: row.geoScope,
    cityId: row.cityId,
    citySlug: row.city?.slug ?? null,
    enabled: Boolean(
      !isBreaking &&
        section &&
        row.status === "PUBLISHED" &&
        row.geoScope &&
        (row.geoScope === "COUNTRY" || row.cityId),
    ),
  };
}
