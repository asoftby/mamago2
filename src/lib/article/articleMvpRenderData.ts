import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findArticleBySlug } from "@/lib/slug/articleSlugService";
import { resolveArticleEmbed } from "@/lib/article/articleEmbedSanitize";
import { parseArticleContentJson, type ArticleBlockMvp } from "@/lib/publications/articleMvp";

/** Без coverImage / seoImageAsset — на старой БД может не быть колонки coverImageId. */
const articleMvpBaseSelect = {
  id: true,
  title: true,
  excerpt: true,
  subtitle: true,
  slug: true,
  status: true,
  publishedAt: true,
  contentJson: true,
  heroImage: true,
  seoOgImage: true,
} as const;

async function fetchArticleCoverImageId(articleId: string): Promise<string | null> {
  try {
    const r = await prisma.$queryRaw<Array<{ coverImageId: string | null }>>(
      Prisma.sql`SELECT "coverImageId" FROM "Article" WHERE id = ${articleId} LIMIT 1`,
    );
    return r[0]?.coverImageId ?? null;
  } catch {
    return null;
  }
}

async function resolveCoverMedia(coverImageId: string | null): Promise<{
  publicUrl: string | null;
  alt: string | null;
} | null> {
  if (!coverImageId) return null;
  return prisma.mediaAsset.findUnique({
    where: { id: coverImageId },
    select: { publicUrl: true, alt: true },
  });
}

export type ResolvedActivityCard = {
  href: string;
  title: string;
  meta?: string;
  imageUrl?: string | null;
};

export type ArticleMvpResolvedBlock =
  | (ArticleBlockMvp & { type: "intro" })
  | (ArticleBlockMvp & { type: "text" })
  | (ArticleBlockMvp & { type: "quote" })
  | (ArticleBlockMvp & { type: "heading" })
  | (Extract<ArticleBlockMvp, { type: "image" }> & { imageUrl: string | null })
  | (Extract<ArticleBlockMvp, { type: "gallery" }> & { imageUrls: (string | null)[] })
  | (Extract<ArticleBlockMvp, { type: "activityCard" }> & { card: ResolvedActivityCard | null })
  | (Extract<ArticleBlockMvp, { type: "embed" }> & {
      sanitizedEmbedHtml: string;
      embedProvider: "youtube" | "instagram" | "unknown";
      embedRequiresInstagramScript: boolean;
    });

async function resolveActivityCard(
  b: Extract<ArticleBlockMvp, { type: "activityCard" }>,
): Promise<ResolvedActivityCard | null> {
  if (!b.entityId.trim()) return null;
  if (b.entityType === "PLACE") {
    const p = await prisma.place.findUnique({
      where: { id: b.entityId },
      select: {
        title: true,
        slug: true,
        city: { select: { slug: true } },
      },
    });
    if (!p?.slug) return { href: "#", title: p?.title ?? "Место" };
    const href = `/places/${p.slug}`;
    return { href, title: p.title };
  }
  if (b.entityType === "EVENT") {
    const a = await prisma.activity.findUnique({
      where: { id: b.entityId },
      select: {
        title: true,
        slug: true,
        type: true,
        place: { select: { city: { select: { slug: true } } } },
      },
    });
    if (!a) return null;
    const citySlug = a.place?.city?.slug;
    const cs = citySlug ?? "minsk";
    const href = `/${cs}/events/${a.slug ?? b.entityId}`;
    return { href, title: a.title };
  }
  const o = await prisma.offer.findUnique({
    where: { id: b.entityId },
    select: { title: true, slug: true },
  });
  if (!o?.slug) return o ? { href: `/offers/${o.slug}`, title: o.title } : null;
  return { href: `/offers/${o.slug}`, title: o.title };
}

export async function buildArticleMvpResolvedBlocks(
  blocks: ArticleBlockMvp[],
): Promise<ArticleMvpResolvedBlock[]> {
  const out: ArticleMvpResolvedBlock[] = [];
  const mediaIds = new Set<string>();
  for (const b of blocks) {
    if (b.type === "image" && b.mediaId) mediaIds.add(b.mediaId);
    if (b.type === "gallery") b.mediaIds.forEach((id) => mediaIds.add(id));
  }
  const assets =
    mediaIds.size > 0
      ? await prisma.mediaAsset.findMany({
          where: { id: { in: [...mediaIds] } },
          select: { id: true, publicUrl: true },
        })
      : [];
  const urlById = new Map(assets.map((a) => [a.id, a.publicUrl]));

  for (const b of blocks) {
    if (b.type === "intro" || b.type === "text" || b.type === "quote" || b.type === "heading") {
      out.push(b);
      continue;
    }
    if (b.type === "image") {
      out.push({
        ...b,
        imageUrl: b.mediaId ? urlById.get(b.mediaId) ?? null : null,
      });
      continue;
    }
    if (b.type === "gallery") {
      out.push({
        ...b,
        imageUrls: b.mediaIds.map((id) => urlById.get(id) ?? null),
      });
      continue;
    }
    if (b.type === "activityCard") {
      const card = await resolveActivityCard(b);
      out.push({ ...b, card });
      continue;
    }
    if (b.type === "embed") {
      const r = resolveArticleEmbed(b.embedHtml);
      out.push({
        ...b,
        sanitizedEmbedHtml: r.sanitizedHtml,
        embedProvider: r.provider,
        embedRequiresInstagramScript: r.requiresInstagramScript,
      });
    }
  }
  return out;
}

export async function loadArticleMvpBySlugPublic(slug: string) {
  const resolved = await findArticleBySlug(slug);
  if (!resolved) return null;
  const article = await prisma.article.findFirst({
    where: {
      id: resolved.articleId,
      status: "PUBLISHED",
    },
    select: articleMvpBaseSelect,
  });
  if (!article) return null;
  const cover = await resolveCoverMedia(await fetchArticleCoverImageId(article.id));
  const content = parseArticleContentJson(article.contentJson);
  if (content.blocks.length === 0) return null;
  const blocks = await buildArticleMvpResolvedBlocks(content.blocks);
  const heroUrl = cover?.publicUrl ?? article.heroImage ?? article.seoOgImage ?? null;
  return {
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    subtitle: article.subtitle,
    slug: article.slug,
    status: article.status,
    publishedAt: article.publishedAt,
    heroUrl,
    heroAlt: cover?.alt ?? article.title,
    blocks,
  };
}

export async function loadArticleMvpById(articleId: string) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: articleMvpBaseSelect,
  });
  if (!article) return null;
  const cover = await resolveCoverMedia(await fetchArticleCoverImageId(articleId));
  const content = parseArticleContentJson(article.contentJson);
  const blocks = await buildArticleMvpResolvedBlocks(content.blocks);
  const heroUrl = cover?.publicUrl ?? article.heroImage ?? article.seoOgImage ?? null;
  return {
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    subtitle: article.subtitle,
    slug: article.slug,
    status: article.status,
    publishedAt: article.publishedAt,
    heroUrl,
    heroAlt: cover?.alt ?? article.title,
    blocks,
  };
}
