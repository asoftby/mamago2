import type { ContentStatus, GeoScope } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma, { searchIndexer } from "@/lib/prisma";
import type { ArticleEditorSnapshot, ArticleSaveInput } from "@/lib/article/articleAdminTypes";
import {
  articleStarterContent,
  parseArticleContentJson,
  serializeArticleContent,
} from "@/lib/publications/articleMvp";
import { resolveArticleSlugOnSaveInTransaction } from "@/lib/slug/resolvePublicationSlug";
import { syncArticleCanonicalInTransaction } from "@/lib/seo/syncEntityCanonical";
import { createRequestPerf } from "@/server/utils/requestPerf";
import {
  assertArticleGeoScope,
  isPublishLikeStatus,
} from "@/lib/article/articleGeoScopeValidation";
import { syncArticleMediaUsage } from "@/server/services/media/media-usage.service";
import { canonicalizeArticleMedia } from "@/server/media/mediaNaming";
import {
  runArticleCriticalWrite,
  runBestEffortArticleEffect,
} from "@/lib/article/articleWriteAtomicity";

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
  categoryId: string | null;
  geoScope: GeoScope | null;
  cityId: string | null;
  regionId: string | null;
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
  tags: Array<{ id: string }>;
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
    categoryId: row.categoryId,
    geoScope: row.geoScope,
    cityId: row.cityId,
    regionId: row.regionId,
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
    tagIds: row.tags.map((tag) => tag.id),
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
  geoScope: true,
  cityId: true,
  regionId: true,
  categoryId: true,
  tags: {
    select: { id: true },
  },
  updatedAt: true,
} as const;

async function assertArticleCategoryValid(categoryId: string | null): Promise<void> {
  if (!categoryId) return;
  const category = await prisma.eventCategory.findFirst({
    where: {
      id: categoryId,
      publicationType: "ARTICLE",
      isActive: true,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (!category) {
    throw new Error("Выберите действительную категорию статьи");
  }
}

function resolvedGeoScope(input: ArticleSaveInput): {
  geoScope: GeoScope | null | undefined;
  cityId: string | null | undefined;
  regionId: string | null | undefined;
} {
  if (input.geoScope === undefined) {
    return { geoScope: undefined, cityId: undefined, regionId: undefined };
  }
  if (input.geoScope === null) {
    return { geoScope: null, cityId: null, regionId: null };
  }
  if (input.geoScope === "COUNTRY") {
    return { geoScope: "COUNTRY", cityId: null, regionId: null };
  }
  if (input.geoScope === "REGION") {
    return { geoScope: "REGION", cityId: null, regionId: input.regionId?.trim() || null };
  }
  return { geoScope: "CITY", cityId: input.cityId?.trim() || null, regionId: null };
}

async function resolveCityContextForGeo(
  input: ArticleSaveInput,
  resolved: ReturnType<typeof resolvedGeoScope>,
): Promise<string | null> {
  if (resolved.geoScope !== "CITY") return null;
  if (!resolved.cityId) return input.cityContext;
  const city = await prisma.city.findUnique({
    where: { id: resolved.cityId },
    select: { slug: true },
  });
  return city?.slug ?? input.cityContext;
}

async function fetchArticleGeoScope(
  id: string,
): Promise<{ geoScope: GeoScope | null; cityId: string | null; regionId: string | null }> {
  const row = await prisma.article.findUnique({
    where: { id },
    select: { geoScope: true, cityId: true, regionId: true },
  });
  if (!row) throw new Error("Article not found");
  return row;
}

function assertGeoScopeValidForPublish(
  geoScope: GeoScope | null,
  cityId: string | null,
  regionId: string | null,
): void {
  assertArticleGeoScope({ geoScope, cityId, regionId, strict: true });
}

function assertGeoScopeValidForSave(
  status: ContentStatus,
  geoScope: GeoScope | null,
  cityId: string | null,
  regionId: string | null,
): void {
  assertArticleGeoScope({
    geoScope,
    cityId,
    regionId,
    strict: isPublishLikeStatus(status),
  });
}

async function fetchArticleMvpEditorialColumns(id: string): Promise<{
  coverImageId: string | null;
  cityContext: string | null;
  scheduledAt: Date | null;
  seoImageId: string | null;
}> {
  const [coverImageId, cityContext, scheduledAt, seoImageId] = await Promise.all([
    prisma.$queryRaw<Array<{ coverImageId: string | null }>>(
      Prisma.sql`SELECT "coverImageId" FROM "Article" WHERE id = ${id} LIMIT 1`,
    )
      .then((rows) => rows[0]?.coverImageId ?? null)
      .catch(() => null),
    prisma.$queryRaw<Array<{ cityContext: string | null }>>(
      Prisma.sql`SELECT "cityContext" FROM "Article" WHERE id = ${id} LIMIT 1`,
    )
      .then((rows) => rows[0]?.cityContext ?? null)
      .catch(() => null),
    prisma.$queryRaw<Array<{ scheduledAt: Date | null }>>(
      Prisma.sql`SELECT "scheduledAt" FROM "Article" WHERE id = ${id} LIMIT 1`,
    )
      .then((rows) => rows[0]?.scheduledAt ?? null)
      .catch(() => null),
    prisma.$queryRaw<Array<{ seoImageId: string | null }>>(
      Prisma.sql`SELECT "seoImageId" FROM "Article" WHERE id = ${id} LIMIT 1`,
    )
      .then((rows) => rows[0]?.seoImageId ?? null)
      .catch(() => null),
  ]);
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
  const perf = createRequestPerf("save-article:service:get");
  const row = await prisma.article.findUnique({
    where: { id },
    select: articleSelect,
  });
  perf.mark("db");
  if (!row) return null;
  const [mvp, author, nv] = await Promise.all([
    fetchArticleMvpEditorialColumns(id),
    fetchArticleAuthorFields(id),
    fetchArticleNoindexAndViews(id),
  ]);
  perf.mark("editorial");
  const [coverImageUrl, seoImageUrl] = await Promise.all([
    resolveMediaUrl(mvp.coverImageId),
    resolveMediaUrl(mvp.seoImageId),
  ]);
  perf.mark("media");
  const snapshot = toSnapshot({
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
  perf.mark("serialize");
  perf.log({ articleId: id });
  return snapshot;
}

async function resolveMediaUrl(id: string | null): Promise<string | null> {
  if (!id) return null;
  const m = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { publicUrl: true },
  });
  return m?.publicUrl ?? null;
}

async function runArticleDerivedSideEffects(
  articleId: string,
  options: { allowPublishedMediaRename: boolean },
): Promise<void> {
  // Prisma transaction hooks can enqueue before commit; this final queued
  // rebuild is guaranteed to observe the committed Article state.
  await runBestEffortArticleEffect("search-index", articleId, async () => {
    await searchIndexer.upsertArticle(articleId);
  });
  await runBestEffortArticleEffect("media-usage", articleId, async () => {
    await syncArticleMediaUsage(articleId);
  });
  await runBestEffortArticleEffect("media-canonicalization", articleId, async () => {
    const results = await canonicalizeArticleMedia(articleId, {
      allowPublished: options.allowPublishedMediaRename,
    });
    for (const result of results) {
      if (result.action === "skip-error") {
        console.error("[article-save:media-canonicalization]", articleId, result);
      }
    }
  });
}

/** Первая запись статьи в БД (после явного «Сохранить» / «Опубликовать»). */
export async function createArticleFromSaveInput(input: ArticleSaveInput): Promise<ArticleEditorSnapshot> {
  const perf = createRequestPerf("save-article:service:create");
  const coverUrl = await resolveMediaUrl(input.coverImageId);
  perf.mark("media");
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const seoOgImageResolved = coverUrl ?? null;
  const resolvedGeo = resolvedGeoScope(input);
  const cityContext = await resolveCityContextForGeo(input, resolvedGeo);

  assertGeoScopeValidForSave(
    input.status,
    resolvedGeo.geoScope ?? null,
    resolvedGeo.cityId ?? null,
    resolvedGeo.regionId ?? null,
  );
  await assertArticleCategoryValid(input.categoryId);

  const created = await runArticleCriticalWrite(prisma, async (tx) => {
    const row = await tx.article.create({
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
        cityContext,
        geoScope: resolvedGeo.geoScope,
        cityId: resolvedGeo.cityId,
        regionId: resolvedGeo.regionId,
        categoryId: input.categoryId,
        noindex: input.noindex,
        tags:
          input.tagIds && input.tagIds.length > 0
            ? { connect: input.tagIds.map((id) => ({ id })) }
            : undefined,
      },
      select: { id: true },
    });
    await resolveArticleSlugOnSaveInTransaction(tx, row.id, input.title, input.slug);
    await syncArticleCanonicalInTransaction(tx, row.id);
    return row;
  });
  perf.mark("db");

  await runArticleDerivedSideEffects(created.id, { allowPublishedMediaRename: true });
  perf.mark("seo");

  const next = await getArticleForEditor(created.id);
  if (!next) throw new Error("Article missing after create");
  perf.mark("response");
  perf.log({ articleId: created.id, status: input.status });
  return next;
}

export async function saveArticleDraft(
  id: string,
  input: ArticleSaveInput,
): Promise<ArticleEditorSnapshot> {
  const perf = createRequestPerf("save-article:service:update");
  const previous = await prisma.article.findUnique({ where: { id }, select: { status: true } });
  if (!previous) throw new Error("Article not found");
  const resolvedGeo = resolvedGeoScope(input);
  const currentGeo = await fetchArticleGeoScope(id);
  const effectiveGeoScope =
    resolvedGeo.geoScope !== undefined ? resolvedGeo.geoScope : currentGeo.geoScope;
  const effectiveCityId =
    resolvedGeo.geoScope !== undefined ? (resolvedGeo.cityId ?? null) : currentGeo.cityId;
  const effectiveRegionId =
    resolvedGeo.geoScope !== undefined ? (resolvedGeo.regionId ?? null) : currentGeo.regionId;

  assertGeoScopeValidForSave(
    input.status,
    effectiveGeoScope,
    effectiveCityId,
    effectiveRegionId,
  );
  await assertArticleCategoryValid(input.categoryId);

  const [coverUrl, editorial] = await Promise.all([
    resolveMediaUrl(input.coverImageId),
    fetchArticleMvpEditorialColumns(id),
  ]);
  perf.mark("media");
  /** Legacy `seoImageId` в БД не трогаем; OG-картинка = обложка, иначе старый отдельный SEO-ассет */
  const legacySeoOgUrl = await resolveMediaUrl(editorial.seoImageId);
  perf.mark("legacy-media");
  const seoOgImageResolved = coverUrl ?? legacySeoOgUrl ?? null;

  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const cityContext =
    resolvedGeo.geoScope !== undefined
      ? await resolveCityContextForGeo(input, resolvedGeo)
      : input.cityContext;

  await runArticleCriticalWrite(prisma, async (tx) => {
    await tx.article.update({
      where: { id },
      data: {
        title: input.title,
        subtitle: input.subtitle,
        excerpt: input.excerpt,
        contentJson: serializeArticleContent(input.content) as object,
        heroImage: coverUrl,
        coverImageId: input.coverImageId,
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
        noindex: input.noindex,
        authorUserId: input.authorUserId,
        authorLabel: input.authorLabel,
        cityContext,
        ...(resolvedGeo.geoScope !== undefined
          ? {
              geoScope: resolvedGeo.geoScope,
              cityId: resolvedGeo.cityId,
              regionId: resolvedGeo.regionId,
            }
          : {}),
        categoryId: input.categoryId,
        tags: { set: (input.tagIds ?? []).map((tagId) => ({ id: tagId })) },
      },
      select: { id: true },
    });
    await resolveArticleSlugOnSaveInTransaction(tx, id, input.title, input.slug);
    await syncArticleCanonicalInTransaction(tx, id);
  });
  perf.mark("db");

  await runArticleDerivedSideEffects(id, {
    allowPublishedMediaRename: previous.status !== "PUBLISHED",
  });
  perf.mark("seo");

  const next = await getArticleForEditor(id);
  if (!next) throw new Error("Article missing after save");
  perf.mark("response");
  perf.log({ articleId: id, status: input.status });
  return next;
}

export async function submitArticleForModeration(id: string): Promise<ArticleEditorSnapshot> {
  await runArticleCriticalWrite(prisma, async (tx) => {
    const row = await tx.article.findUnique({
      where: { id },
      select: { title: true, slug: true, geoScope: true, cityId: true, regionId: true },
    });
    if (!row) throw new Error("Article not found");
    assertGeoScopeValidForPublish(row.geoScope, row.cityId, row.regionId);
    if (!row.slug?.trim()) {
      await resolveArticleSlugOnSaveInTransaction(tx, id, row.title, null);
    }
    await syncArticleCanonicalInTransaction(tx, id);
    await tx.article.update({
      where: { id },
      data: { status: "PENDING" },
      select: { id: true },
    });
  });
  await runBestEffortArticleEffect("search-index", id, async () => {
    await searchIndexer.upsertArticle(id);
  });
  const next = await getArticleForEditor(id);
  if (!next) throw new Error("Article missing after submit");
  return next;
}

export async function moderateArticle(
  id: string,
  decision: "publish" | "reject",
): Promise<ArticleEditorSnapshot> {
  if (decision === "reject") {
    await prisma.article.update({
      where: { id },
      data: { status: "REJECTED" },
      select: { id: true },
    });
    const rejected = await getArticleForEditor(id);
    if (!rejected) throw new Error("Article missing after reject");
    return rejected;
  }
  await runArticleCriticalWrite(prisma, async (tx) => {
    const row = await tx.article.findUnique({
      where: { id },
      select: { title: true, slug: true, geoScope: true, cityId: true, regionId: true },
    });
    if (!row) throw new Error("Article not found");
    assertGeoScopeValidForPublish(row.geoScope, row.cityId, row.regionId);
    if (!row.slug?.trim()) {
      await resolveArticleSlugOnSaveInTransaction(tx, id, row.title, null);
    }
    await syncArticleCanonicalInTransaction(tx, id);
    await tx.article.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      select: { id: true },
    });
  });
  await runBestEffortArticleEffect("search-index", id, async () => {
    await searchIndexer.upsertArticle(id);
  });
  const published = await getArticleForEditor(id);
  if (!published) throw new Error("Article missing after publish");
  return published;
}
