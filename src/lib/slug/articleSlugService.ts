/**
 * Article slug service
 *
 * Principles:
 * - Slug is auto-assigned ONCE when title becomes meaningful
 * - Slug never changes automatically afterwards
 * - Manual slug change via SEO editor stores old slug in history
 */

import { prisma } from "@/lib/prisma";
import { slugifyRu } from "@/lib/slugify";
import { ensureUniqueSlug } from "@/lib/slug/ensureUniqueSlug";
import { createArticleSlugHistoryIgnoreDuplicate } from "@/lib/slug/slugHistoryDedupe";
import { syncArticleCanonical } from "@/lib/seo/syncEntityCanonical";

async function isSlugAvailable(slug: string, excludeArticleId?: string) {
  const existing = await prisma.article.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== excludeArticleId) return false;

  const history = await prisma.articleSlugHistory.findUnique({
    where: { slug },
    select: { articleId: true },
  });
  if (history && history.articleId !== excludeArticleId) return false;

  return true;
}

export async function generateArticleSlugFromTitle(title: string, excludeArticleId?: string) {
  const base = slugifyRu((title || "article").trim(), "article");
  return ensureUniqueSlug({ base, isAvailable: (s) => isSlugAvailable(s, excludeArticleId) });
}

export async function assignArticleSlugIfMissing(articleId: string, title: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, slug: true },
  });
  if (!article) throw new Error(`Article not found: ${articleId}`);
  if (article.slug) return article.slug;

  const slug = await generateArticleSlugFromTitle(title, articleId);
  await prisma.$transaction(async (tx) => {
    await createArticleSlugHistoryIgnoreDuplicate(tx, articleId, articleId);
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
   * Если true — slug должен быть свободен ровно в запрошенном виде (после slugify).
   * Иначе при конфликте к базе добавляется суффикс (-2, -3, …), как раньше.
   */
  strict?: boolean;
};

export async function updateArticleSlug(
  articleId: string,
  newSlugRaw: string,
  options?: UpdateArticleSlugOptions,
) {
  const trimmed = newSlugRaw.trim();
  /** Пустая строка: прежнее поведение slugifyRu (fallback), нужно для SEO-апдейтов без strict. */
  const newSlug = trimmed ? slugifyRu(trimmed) : slugifyRu(newSlugRaw);

  if (options?.strict) {
    if (!trimmed) {
      throw new Error("Укажите корректный slug или оставьте поле пустым для автогенерации");
    }
    const ok = await isSlugAvailable(newSlug, articleId);
    if (!ok) {
      throw new Error("Этот адрес (slug) уже занят другой статьёй или зарезервирован в истории URL");
    }
  }

  await prisma.$transaction(async (tx) => {
    const article = await tx.article.findUnique({
      where: { id: articleId },
      select: { slug: true },
    });
    if (!article) throw new Error(`Article not found: ${articleId}`);
    if (article.slug === newSlug) return;

    if (!article.slug) {
      await createArticleSlugHistoryIgnoreDuplicate(tx, articleId, articleId);
    }

    const finalSlug = options?.strict
      ? newSlug
      : await ensureUniqueSlug({
          base: newSlug,
          isAvailable: async (s) => {
            const conflict = await tx.article.findUnique({ where: { slug: s }, select: { id: true } });
            const hist = await tx.articleSlugHistory.findUnique({
              where: { slug: s },
              select: { articleId: true },
            });
            return (!conflict || conflict.id === articleId) && (!hist || hist.articleId === articleId);
          },
        });

    if (article.slug) {
      await createArticleSlugHistoryIgnoreDuplicate(tx, articleId, article.slug);
    }
    await tx.article.update({
      where: { id: articleId },
      data: { slug: finalSlug, slugUpdatedAt: new Date() },
      select: { id: true },
    });
  });
  await syncArticleCanonical(articleId);
}

export async function findArticleBySlug(slug: string): Promise<{ articleId: string; isRedirect: boolean } | null> {
  const current = await prisma.article.findUnique({ where: { slug }, select: { id: true } });
  if (current) return { articleId: current.id, isRedirect: false };

  const hist = await prisma.articleSlugHistory.findUnique({ where: { slug }, select: { articleId: true } });
  if (hist) return { articleId: hist.articleId, isRedirect: true };

  return null;
}

