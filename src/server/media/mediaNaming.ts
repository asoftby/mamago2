import { access, copyFile, readdir, unlink } from "fs/promises";
import { basename, extname } from "path";
import prisma from "@/lib/prisma";
import { extractArticleMediaUsage, parseArticleContentJson } from "@/lib/publications/articleMvp";
import {
  buildMediaFilePublicUrl,
  resolveStoredMediaPath,
} from "@/server/media/media-storage";
import {
  buildMasterFilename,
  buildMediaStem,
  buildResponsiveFilename,
  type MediaFilenameContext,
} from "@/lib/media/mediaNamingCore";

export { buildMasterFilename, buildMediaStem, buildResponsiveFilename } from "@/lib/media/mediaNamingCore";
export type { MediaFilenameContext } from "@/lib/media/mediaNamingCore";

export async function getArticleMediaOrder(articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) return null;
  const content = parseArticleContentJson(article.contentJson);
  const entries = extractArticleMediaUsage({
    coverImageId: article.coverImageId,
    seoImageId: article.seoImageId,
    blocks: content.blocks,
  });
  return { article, mediaIds: entries.map((entry) => entry.mediaId) };
}

export async function resolveArticleUploadContext(articleId: string, mediaId?: string) {
  const ordered = await getArticleMediaOrder(articleId);
  if (!ordered?.article.slug || !ordered.article.title) return null;
  let sequence = mediaId ? ordered.mediaIds.indexOf(mediaId) + 1 : ordered.mediaIds.length + 1;
  if (!mediaId) {
    const prefix = `${buildMediaStem({ type: "ARTICLE", id: ordered.article.id, title: ordered.article.title, slug: ordered.article.slug, sequence: 1 }).replace(/01$/, "")}`;
    const existing = await prisma.mediaAsset.findMany({
      where: { filename: { startsWith: prefix } },
      select: { filename: true },
    });
    const used = existing
      .map((asset) => asset.filename.match(/-(\d+)\.webp$/)?.[1])
      .map((value) => Number(value))
      .filter(Number.isFinite);
    sequence = Math.max(sequence, (used.length ? Math.max(...used) : 0) + 1);
  }
  return {
    type: "ARTICLE" as const,
    id: ordered.article.id,
    title: ordered.article.title,
    slug: ordered.article.slug,
    sequence: Math.max(1, sequence),
  };
}

export type CanonicalizeResult = {
  mediaId: string;
  action: "rename" | "metadata-only" | "skip-shared" | "skip-external" | "skip-error" | "none";
  oldFilename: string;
  newFilename: string;
  oldUrl: string | null;
  newUrl: string | null;
  usageCount: number;
  reason: string;
};

async function uniqueEntityUsageCount(mediaId: string): Promise<number> {
  const [usages, articles] = await Promise.all([
    prisma.mediaUsage.findMany({ where: { mediaId }, select: { entityType: true, entityId: true } }),
    // MediaUsage can be stale on legacy data. Re-extract the canonical Article
    // projection (cover + SEO + ordered blocks) before any rename decision.
    prisma.article.findMany({ select: { id: true, coverImageId: true, seoImageId: true, contentJson: true } }),
  ]);
  const entities = new Set(usages.map((u) => `${u.entityType}:${u.entityId}`));
  for (const article of articles) {
    const content = parseArticleContentJson(article.contentJson);
    const used = extractArticleMediaUsage({
      coverImageId: article.coverImageId,
      seoImageId: article.seoImageId,
      blocks: content.blocks,
    }).some((entry) => entry.mediaId === mediaId);
    if (used) entities.add(`ARTICLE:${article.id}`);
  }
  return entities.size;
}

async function existingResponsiveFiles(masterPath: string): Promise<Array<{ oldPath: string; suffix: string }>> {
  const oldStem = basename(masterPath, extname(masterPath));
  const dir = masterPath.slice(0, masterPath.length - basename(masterPath).length);
  const names = await readdir(dir);
  return names
    .filter((name) => name.startsWith(`${oldStem}-`) && extname(name).toLowerCase() === ".webp")
    .map((name) => ({ oldPath: `${dir}${name}`, suffix: basename(name, ".webp").slice(oldStem.length + 1) }));
}

export async function canonicalizeMediaAsset(input: {
  mediaId: string;
  context: MediaFilenameContext;
  allowPublished?: boolean;
  dryRun?: boolean;
  usageCount?: number;
}): Promise<CanonicalizeResult> {
  const media = await prisma.mediaAsset.findUnique({ where: { id: input.mediaId } });
  const targetFilename = buildMasterFilename(buildMediaStem(input.context));
  if (!media) return { mediaId: input.mediaId, action: "skip-error", oldFilename: "", newFilename: targetFilename, oldUrl: null, newUrl: null, usageCount: 0, reason: "media-not-found" };
  const usageCount = input.usageCount ?? await uniqueEntityUsageCount(media.id);
  const base = { mediaId: media.id, oldFilename: media.filename, newFilename: targetFilename, oldUrl: media.publicUrl, usageCount };
  if (input.context.type === "ARTICLE") {
    const article = await prisma.article.findUnique({ where: { id: input.context.id }, select: { status: true } });
    if (!article) return { ...base, action: "skip-error", newUrl: null, reason: "article-not-found" };
    if (article.status === "PUBLISHED" && !input.allowPublished) return { ...base, action: "none", newUrl: media.publicUrl, reason: "published-url-immutable" };
    if (usageCount > 1) return { ...base, action: "skip-shared", newUrl: media.publicUrl, reason: "asset-used-by-multiple-entities" };
  }
  const newUrl = buildMediaFilePublicUrl(targetFilename);
  const title = input.context.type === "ARTICLE" ? input.context.title : buildMediaStem(input.context);
  if (media.filename === targetFilename && media.publicUrl === newUrl && media.storageKey === newUrl && media.title === title) {
    return { ...base, action: "none", newUrl, reason: "already-canonical" };
  }
  const oldPath = resolveStoredMediaPath(media.publicUrl ?? media.storageKey);
  const newPath = resolveStoredMediaPath(newUrl);
  if (!oldPath || !newPath) return { ...base, action: "skip-external", newUrl: media.publicUrl, reason: "not-managed-runtime-storage" };
  try {
    await access(oldPath);
  } catch {
    return { ...base, action: "skip-external", newUrl: media.publicUrl, reason: "managed-source-file-missing" };
  }
  if (oldPath !== newPath) {
    const occupied = await prisma.mediaAsset.findUnique({ where: { storageKey: newUrl }, select: { id: true } });
    if (occupied && occupied.id !== media.id) {
      return { ...base, action: "skip-error", newUrl: media.publicUrl, reason: "canonical-target-owned-by-another-asset" };
    }
    try {
      await access(newPath);
      return { ...base, action: "skip-error", newUrl: media.publicUrl, reason: "canonical-target-file-already-exists" };
    } catch {
      // Expected: a safe rename only creates a previously absent target.
    }
  }
  if (input.dryRun) return { ...base, action: media.filename === targetFilename ? "metadata-only" : "rename", newUrl, reason: "dry-run" };

  const responsive = await existingResponsiveFiles(oldPath);
  const created: string[] = [];
  try {
    if (oldPath !== newPath) {
      await copyFile(oldPath, newPath);
      await access(newPath);
      created.push(newPath);
      for (const item of responsive) {
        const targetUrl = buildMediaFilePublicUrl(buildResponsiveFilename(buildMediaStem(input.context), item.suffix));
        const targetPath = resolveStoredMediaPath(targetUrl);
        if (!targetPath) throw new Error("invalid-responsive-target");
        await copyFile(item.oldPath, targetPath);
        await access(targetPath);
        created.push(targetPath);
      }
    }
    await prisma.$transaction([
      prisma.mediaAsset.update({ where: { id: media.id }, data: { filename: targetFilename, storageKey: newUrl, publicUrl: newUrl, title } }),
      prisma.article.updateMany({ where: { heroImage: media.publicUrl }, data: { heroImage: newUrl } }),
      prisma.article.updateMany({ where: { seoOgImage: media.publicUrl }, data: { seoOgImage: newUrl } }),
    ]);
  } catch (error) {
    await Promise.allSettled(created.map((path) => unlink(path)));
    return { ...base, action: "skip-error", newUrl: media.publicUrl, reason: error instanceof Error ? error.message : String(error) };
  }
  if (oldPath !== newPath) {
    await Promise.allSettled([unlink(oldPath), ...responsive.map((item) => unlink(item.oldPath))]);
  }
  return { ...base, action: media.filename === targetFilename ? "metadata-only" : "rename", newUrl, reason: "canonicalized" };
}

export async function canonicalizeArticleMedia(articleId: string, options?: { allowPublished?: boolean; dryRun?: boolean }) {
  const ordered = await getArticleMediaOrder(articleId);
  if (!ordered?.article.slug) return [];
  const [allArticles, usageRows] = await Promise.all([
    prisma.article.findMany({ select: { id: true, coverImageId: true, seoImageId: true, contentJson: true } }),
    prisma.mediaUsage.findMany({
      where: { mediaId: { in: ordered.mediaIds } },
      select: { mediaId: true, entityType: true, entityId: true },
    }),
  ]);
  const entitiesByMedia = new Map(ordered.mediaIds.map((id) => [id, new Set<string>()]));
  for (const usage of usageRows) entitiesByMedia.get(usage.mediaId)?.add(`${usage.entityType}:${usage.entityId}`);
  for (const article of allArticles) {
    const content = parseArticleContentJson(article.contentJson);
    for (const entry of extractArticleMediaUsage({ coverImageId: article.coverImageId, seoImageId: article.seoImageId, blocks: content.blocks })) {
      entitiesByMedia.get(entry.mediaId)?.add(`ARTICLE:${article.id}`);
    }
  }
  const results: CanonicalizeResult[] = [];
  for (const [index, mediaId] of ordered.mediaIds.entries()) {
    results.push(await canonicalizeMediaAsset({
      mediaId,
      context: { type: "ARTICLE", id: articleId, title: ordered.article.title, slug: ordered.article.slug, sequence: index + 1 },
      usageCount: entitiesByMedia.get(mediaId)?.size ?? 0,
      ...options,
    }));
  }
  return results;
}
