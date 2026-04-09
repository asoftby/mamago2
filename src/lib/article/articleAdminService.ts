import type { ContentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { ArticleEditorSnapshot, ArticleSaveInput } from "@/lib/article/articleAdminTypes";
import {
  articleStarterContent,
  parseArticleContentJson,
  serializeArticleContent,
} from "@/lib/publications/articleMvp";
import { assignArticleSlugIfMissing, updateArticleSlug } from "@/lib/slug/articleSlugService";
import { syncArticleCanonical } from "@/lib/seo/syncEntityCanonical";

export type { ArticleEditorSnapshot, ArticleSaveInput } from "@/lib/article/articleAdminTypes";
export {
  buildEmptyArticleEditorSnapshot,
  buildEmptyBreakingNewsEditorSnapshot,
} from "@/lib/article/articleEditorEmptySnapshots";

function toSnapshot(row: {
  id: string;
  title: string;
  slug: string | null;
  subtitle: string | null;
  excerpt: string | null;
  contentJson: unknown;
  heroImage: string | null;
  coverImageId: string | null;
  coverImage: { publicUrl: string | null } | null;
  authorUserId: string | null;
  authorLabel: string | null;
  cityContext: string | null;
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalUrl: string | null;
  seoOgTitle: string | null;
  seoOgDescription: string | null;
  seoOgImage: string | null;
  seoImageId: string | null;
  seoImageAsset: { publicUrl: string | null } | null;
  seoRobots: string | null;
  noindex: boolean;
  views: number;
  updatedAt: Date;
}): ArticleEditorSnapshot {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    excerpt: row.excerpt,
    content: parseArticleContentJson(row.contentJson),
    heroImage: row.heroImage,
    coverImageId: row.coverImageId,
    coverImageUrl: row.coverImage?.publicUrl ?? null,
    authorUserId: row.authorUserId,
    authorLabel: row.authorLabel,
    cityContext: row.cityContext,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    seoCanonicalUrl: row.seoCanonicalUrl,
    seoOgTitle: row.seoOgTitle,
    seoOgDescription: row.seoOgDescription,
    seoOgImage: row.seoOgImage,
    seoImageId: row.seoImageId,
    seoImageUrl: row.seoImageAsset?.publicUrl ?? null,
    seoRobots: row.seoRobots,
    noindex: row.noindex,
    views: row.views,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Только колонки из первичной таблицы Article (route_article_seo).
 * coverImageId, cityContext, scheduledAt, seoImageId — из article_mvp_editorial_fields; через $queryRaw.
 */
const articleSelect = {
  id: true,
  title: true,
  slug: true,
  subtitle: true,
  excerpt: true,
  contentJson: true,
  heroImage: true,
  status: true,
  publishedAt: true,
  seoTitle: true,
  seoDescription: true,
  seoCanonicalUrl: true,
  seoOgTitle: true,
  seoOgDescription: true,
  seoOgImage: true,
  seoRobots: true,
  updatedAt: true,
} as const;

async function fetchArticleMvpEditorialColumns(id: string): Promise<{
  coverImageId: string | null;
  cityContext: string | null;
  scheduledAt: Date | null;
  seoImageId: string | null;
}> {
  let coverImageId: string | null = null;
  try {
    const r = await prisma.$queryRaw<Array<{ coverImageId: string | null }>>(
      Prisma.sql`SELECT "coverImageId" FROM "Article" WHERE id = ${id} LIMIT 1`,
    );
    coverImageId = r[0]?.coverImageId ?? null;
  } catch {
    /* колонки нет */
  }
  let cityContext: string | null = null;
  try {
    const r = await prisma.$queryRaw<Array<{ cityContext: string | null }>>(
      Prisma.sql`SELECT "cityContext" FROM "Article" WHERE id = ${id} LIMIT 1`,
    );
    cityContext = r[0]?.cityContext ?? null;
  } catch {
    /* */
  }
  let scheduledAt: Date | null = null;
  try {
    const r = await prisma.$queryRaw<Array<{ scheduledAt: Date | null }>>(
      Prisma.sql`SELECT "scheduledAt" FROM "Article" WHERE id = ${id} LIMIT 1`,
    );
    scheduledAt = r[0]?.scheduledAt ?? null;
  } catch {
    /* */
  }
  let seoImageId: string | null = null;
  try {
    const r = await prisma.$queryRaw<Array<{ seoImageId: string | null }>>(
      Prisma.sql`SELECT "seoImageId" FROM "Article" WHERE id = ${id} LIMIT 1`,
    );
    seoImageId = r[0]?.seoImageId ?? null;
  } catch {
    /* */
  }
  return { coverImageId, cityContext, scheduledAt, seoImageId };
}

/** noindex / views из миграции article_mvp_editorial_fields — на старой БД колонок может не быть. */
async function fetchArticleNoindexAndViews(
  id: string,
): Promise<{ noindex: boolean; views: number }> {
  try {
    const r = await prisma.$queryRaw<Array<{ noindex: boolean; views: bigint | number | null }>>(
      Prisma.sql`SELECT "noindex", views FROM "Article" WHERE id = ${id} LIMIT 1`,
    );
    const row = r[0];
    return {
      noindex: row?.noindex ?? false,
      views: Number(row?.views ?? 0),
    };
  } catch {
    return { noindex: false, views: 0 };
  }
}

async function fetchArticleAuthorFields(
  id: string,
): Promise<{ authorUserId: string | null; authorLabel: string | null }> {
  try {
    const r = await prisma.$queryRaw<Array<{ authorUserId: string | null; authorLabel: string | null }>>(
      Prisma.sql`SELECT "authorUserId", "authorLabel" FROM "Article" WHERE id = ${id} LIMIT 1`,
    );
    const row = r[0];
    return { authorUserId: row?.authorUserId ?? null, authorLabel: row?.authorLabel ?? null };
  } catch {
    try {
      const r = await prisma.$queryRaw<Array<{ authorLabel: string | null }>>(
        Prisma.sql`SELECT "authorLabel" FROM "Article" WHERE id = ${id} LIMIT 1`,
      );
      return { authorUserId: null, authorLabel: r[0]?.authorLabel ?? null };
    } catch {
      return { authorUserId: null, authorLabel: null };
    }
  }
}

export async function getArticleForEditor(id: string): Promise<ArticleEditorSnapshot | null> {
  const row = await prisma.article.findUnique({
    where: { id },
    select: articleSelect,
  });
  if (!row) return null;
  const mvp = await fetchArticleMvpEditorialColumns(id);
  const coverImageUrl = await resolveMediaUrl(mvp.coverImageId);
  const seoImageUrl = await resolveMediaUrl(mvp.seoImageId);
  const author = await fetchArticleAuthorFields(id);
  const nv = await fetchArticleNoindexAndViews(id);
  return toSnapshot({
    ...row,
    coverImageId: mvp.coverImageId,
    coverImage: mvp.coverImageId ? { publicUrl: coverImageUrl } : null,
    cityContext: mvp.cityContext,
    scheduledAt: mvp.scheduledAt,
    seoImageId: mvp.seoImageId,
    seoImageAsset: mvp.seoImageId ? { publicUrl: seoImageUrl } : null,
    ...author,
    ...nv,
  });
}

async function resolveMediaUrl(id: string | null): Promise<string | null> {
  if (!id) return null;
  const m = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { publicUrl: true },
  });
  return m?.publicUrl ?? null;
}

/** Первая запись статьи в БД (после явного «Сохранить» / «Опубликовать»). */
export async function createArticleFromSaveInput(input: ArticleSaveInput): Promise<ArticleEditorSnapshot> {
  const coverUrl = await resolveMediaUrl(input.coverImageId);
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const seoOgImageResolved = coverUrl ?? null;

  const created = await prisma.article.create({
    data: {
      title: input.title,
      subtitle: input.subtitle,
      excerpt: input.excerpt,
      contentJson: serializeArticleContent(input.content) as object,
      heroImage: coverUrl,
      status: input.status,
      publishedAt,
      scheduledAt,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoCanonicalUrl: input.seoCanonicalUrl,
      seoOgTitle: input.seoOgTitle,
      seoOgDescription: input.seoOgDescription,
      seoOgImage: seoOgImageResolved,
      seoRobots: input.noindex ? "noindex, nofollow" : input.seoRobots,
      authorUserId: input.authorUserId,
      authorLabel: input.authorLabel,
      coverImageId: input.coverImageId,
      cityContext: input.cityContext,
      noindex: input.noindex,
    },
    select: { id: true },
  });

  if (input.slug?.trim()) {
    await updateArticleSlug(created.id, input.slug.trim(), { strict: true });
  } else {
    await assignArticleSlugIfMissing(created.id, input.title);
  }
  await syncArticleCanonical(created.id);

  const next = await getArticleForEditor(created.id);
  if (!next) throw new Error("Article missing after create");
  return next;
}

export async function saveArticleDraft(
  id: string,
  input: ArticleSaveInput,
): Promise<ArticleEditorSnapshot> {
  const coverUrl = await resolveMediaUrl(input.coverImageId);
  /** Legacy `seoImageId` в БД не трогаем; OG-картинка = обложка, иначе старый отдельный SEO-ассет */
  const editorial = await fetchArticleMvpEditorialColumns(id);
  const legacySeoOgUrl = await resolveMediaUrl(editorial.seoImageId);
  const seoOgImageResolved = coverUrl ?? legacySeoOgUrl ?? null;

  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;

  /** `select: { id: true }` — иначе Prisma вернёт все колонки модели в RETURNING, включая отсутствующие в БД (coverImageId и т.д.). */
  await prisma.article.update({
    where: { id },
    data: {
      title: input.title,
      subtitle: input.subtitle,
      excerpt: input.excerpt,
      contentJson: serializeArticleContent(input.content) as object,
      heroImage: coverUrl,
      status: input.status,
      publishedAt,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoCanonicalUrl: input.seoCanonicalUrl,
      seoOgTitle: input.seoOgTitle,
      seoOgDescription: input.seoOgDescription,
      seoOgImage: seoOgImageResolved,
      seoRobots: input.noindex ? "noindex, nofollow" : input.seoRobots,
    },
    select: { id: true },
  });

  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Article" SET "coverImageId" = ${input.coverImageId} WHERE id = ${id}`,
    );
  } catch {
    /* колонки нет */
  }
  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Article" SET "cityContext" = ${input.cityContext} WHERE id = ${id}`,
    );
  } catch {
    /* */
  }
  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Article" SET "scheduledAt" = ${scheduledAt} WHERE id = ${id}`,
    );
  } catch {
    /* */
  }
  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Article" SET "noindex" = ${input.noindex} WHERE id = ${id}`,
    );
  } catch {
    /* колонки noindex нет */
  }

  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Article" SET "authorUserId" = ${input.authorUserId}, "authorLabel" = ${input.authorLabel} WHERE id = ${id}`,
    );
  } catch {
    try {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "Article" SET "authorLabel" = ${input.authorLabel} WHERE id = ${id}`,
      );
    } catch {
      /* нет колонок в старой БД */
    }
  }

  if (input.slug?.trim()) {
    await updateArticleSlug(id, input.slug.trim(), { strict: true });
  } else {
    await assignArticleSlugIfMissing(id, input.title);
  }

  await syncArticleCanonical(id);

  const next = await getArticleForEditor(id);
  if (!next) throw new Error("Article missing after save");
  return next;
}

export async function submitArticleForModeration(id: string): Promise<void> {
  await prisma.article.update({
    where: { id },
    data: { status: "PENDING" },
    select: { id: true },
  });
}

export async function moderateArticle(
  id: string,
  decision: "publish" | "reject",
): Promise<void> {
  if (decision === "reject") {
    await prisma.article.update({
      where: { id },
      data: { status: "REJECTED" },
      select: { id: true },
    });
    return;
  }
  await prisma.article.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  await syncArticleCanonical(id);
}
