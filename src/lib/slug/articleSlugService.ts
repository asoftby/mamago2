/**
 * Article slug service — city-scoped.
 *
 * Principles:
 * - Slug is auto-assigned ONCE when title becomes meaningful
 * - Slug never changes automatically afterwards
 * - Manual slug change via SEO editor stores old slug in history
 * - All lookups are city-scoped: (cityId, slug) is the composite key
 *   CITY articles  → cityId IS NOT NULL
 *   COUNTRY articles → cityId IS NULL  (national blog)
 */

import { prisma } from "@/lib/prisma";
import { articleSlugScopeWhere } from "@/lib/slug/articleSlugScope";
import { ensureUniqueSlug } from "@/lib/slug/ensureUniqueSlug";
import { createArticleSlugHistoryIgnoreDuplicate } from "@/lib/slug/slugHistoryDedupe";
import {
  EmptyPublicationSlugError,
  isMeaningfulPublicationTitle,
  normalizeSlugStrict,
  resolveSlugCandidateForSave,
} from "@/lib/slug/publicSlug";
import { syncArticleCanonical } from "@/lib/seo/syncEntityCanonical";

export { articleSlugScopeWhere, articlesShareSlugScope } from "@/lib/slug/articleSlugScope";

/** Запись в ArticleSlugHistory при смене slug у уже опубликованной статьи. */
export function shouldRecordArticleSlugHistory(
  previousSlug: string | null | undefined,
  nextSlug: string,
): boolean {
  return Boolean(previousSlug && previousSlug !== nextSlug);
}

/**
 * Check whether a slug is free within a given city scope.
 *
 * @param slug          The slug to check.
 * @param cityId        City scope (null = COUNTRY scope).
 * @param excludeArticleId  Article id to exclude from the conflict check (for updates).
 */
async function isSlugAvailable(
  slug: string,
  cityId: string | null,
  excludeArticleId?: string,
) {
  const scope = articleSlugScopeWhere(slug, cityId);
  const existing = await prisma.article.findFirst({
    where: scope,
    select: { id: true },
  });
  if (existing && existing.id !== excludeArticleId) return false;

  const history = await prisma.articleSlugHistory.findFirst({
    where: scope,
    select: { articleId: true },
  });
  if (history && history.articleId !== excludeArticleId) return false;

  return true;
}

export async function generateArticleSlugFromTitle(
  title: string,
  cityId: string | null,
  excludeArticleId?: string,
) {
  const base = resolveSlugCandidateForSave({
    title: isMeaningfulPublicationTitle(title) ? title : "",
    slugInput: null,
    entityType: "article",
    entityId: excludeArticleId ?? "draft",
    allowIdFallback: true,
  });
  return ensureUniqueSlug({
    base,
    isAvailable: (s) => isSlugAvailable(s, cityId, excludeArticleId),
  });
}

export async function assignArticleSlugIfMissing(
  articleId: string,
  title: string,
) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, slug: true, cityId: true },
  });
  if (!article) throw new Error(`Article not found: ${articleId}`);
  if (article.slug) return article.slug;

  const slug = await generateArticleSlugFromTitle(title, article.cityId, articleId);
  await prisma.$transaction(async (tx) => {
    await createArticleSlugHistoryIgnoreDuplicate(tx, articleId, articleId, article.cityId);
    await tx.article.update({
      where: { id: articleId },
      data: { slug, slugUpdatedAt: new Date() },
      select: { id: true },
    });
  });
  await syncArticleCanonical(articleId);
  return slug;
}

export type UpdateArticleSlugOptions = {
  /**
   * If true — slug must be free exactly as-is (after slugify).
   * Otherwise on conflict a suffix (-2, -3, …) is appended.
   */
  strict?: boolean;
};

export async function updateArticleSlug(
  articleId: string,
  newSlugRaw: string,
  options?: UpdateArticleSlugOptions,
) {
  const trimmed = newSlugRaw.trim();
  const newSlug = trimmed
    ? normalizeSlugStrict(trimmed) || (() => { throw new EmptyPublicationSlugError(); })()
    : normalizeSlugStrict(newSlugRaw);
  if (!newSlug) {
    throw new EmptyPublicationSlugError();
  }

  // We need the cityId to scope the uniqueness check
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { slug: true, cityId: true },
  });
  if (!article) throw new Error(`Article not found: ${articleId}`);

  const cityId = article.cityId;

  if (options?.strict) {
    if (!trimmed) {
      throw new Error("Укажите корректный slug или оставьте поле пустым для автогенерации");
    }
    const ok = await isSlugAvailable(newSlug, cityId, articleId);
    if (!ok) {
      throw new Error(
        "Этот адрес (slug) уже занят другой статьёй или зарезервирован в истории URL",
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.article.findUnique({
      where: { id: articleId },
      select: { slug: true, cityId: true },
    });
    if (!current) throw new Error(`Article not found: ${articleId}`);
    if (current.slug === newSlug) return;

    if (!current.slug) {
      await createArticleSlugHistoryIgnoreDuplicate(tx, articleId, articleId, current.cityId);
    }

    const finalSlug = options?.strict
      ? newSlug
      : await ensureUniqueSlug({
          base: newSlug,
          isAvailable: async (s) => {
            const scope = articleSlugScopeWhere(s, current.cityId);
            const conflict = await tx.article.findFirst({
              where: scope,
              select: { id: true },
            });
            const hist = await tx.articleSlugHistory.findFirst({
              where: scope,
              select: { articleId: true },
            });
            return (
              (!conflict || conflict.id === articleId) &&
              (!hist || hist.articleId === articleId)
            );
          },
        });

    if (shouldRecordArticleSlugHistory(current.slug, finalSlug)) {
      await createArticleSlugHistoryIgnoreDuplicate(
        tx,
        articleId,
        current.slug!,
        current.cityId,
      );
    }
    await tx.article.update({
      where: { id: articleId },
      data: { slug: finalSlug, slugUpdatedAt: new Date() },
      select: { id: true },
    });
  });
  await syncArticleCanonical(articleId);
}

/**
 * Find an article by slug within a city scope.
 *
 * @param slug    The slug to look up.
 * @param cityId  City scope (null = COUNTRY scope).
 */
export async function findArticleBySlug(
  slug: string,
  cityId: string | null,
): Promise<{ articleId: string; isRedirect: boolean } | null> {
  const current = await prisma.article.findFirst({
    where: { slug, cityId: cityId ?? null },
    select: { id: true },
  });
  if (current) return { articleId: current.id, isRedirect: false };

  const hist = await prisma.articleSlugHistory.findFirst({
    where: { slug, cityId: cityId ?? null },
    select: { articleId: true },
  });
  if (hist) return { articleId: hist.articleId, isRedirect: true };

  return null;
}
