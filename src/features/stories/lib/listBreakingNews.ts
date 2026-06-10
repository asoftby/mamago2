import prisma from "@/lib/prisma";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";
import { parseArticleContentJson } from "@/lib/publications/articleMvp";
import { stripHtml } from "@/lib/search/sanitizeSearchText";

export type BreakingNewsItem = {
  id: string;
  title: string;
  excerpt: string | null;
  description: string | null;
  imageUrl: string | null;
  publishedAt: string;
  href: string | null;
};

/**
 * Fetches up to 6 published breaking news articles for a given city.
 * Breaking news is identified by subtitle === "__breaking_news__".
 * Sorted by publishedAt descending (newest first).
 */
export async function listBreakingNewsArticles(
  citySlug: string,
  limit = 6,
): Promise<BreakingNewsItem[]> {
  const now = new Date();

  const rows = await prisma.article.findMany({
    where: {
      AND: [
        {
          OR: [
            { cityContext: citySlug },
            { cityContext: null },
          ],
        },
      ],
      subtitle: BREAKING_NEWS_SUBTITLE,
      status: "PUBLISHED",
      publishedAt: { not: null, lte: now },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      excerpt: true,
      contentJson: true,
      coverImageId: true,
      heroImage: true,
      seoOgImage: true,
      publishedAt: true,
      slug: true,
      geoScope: true,
      city: { select: { slug: true } },
    },
  });

  const coverImageIds = rows
    .map((row) => row.coverImageId?.trim() ?? null)
    .filter((id): id is string => Boolean(id));

  const coverAssets =
    coverImageIds.length > 0
      ? await prisma.mediaAsset.findMany({
          where: { id: { in: coverImageIds } },
          select: { id: true, publicUrl: true },
        })
      : [];

  const coverUrlById = new Map(
    coverAssets.map((asset) => [asset.id, asset.publicUrl?.trim() ?? null]),
  );

  return rows
    .filter((r): r is typeof r & { publishedAt: Date } =>
      Boolean(r.publishedAt)
    )
    .map((r) => {
      const content = parseArticleContentJson(r.contentJson);
      const firstTextBlock = content.blocks.find(
        (block): block is Extract<(typeof content.blocks)[number], { type: "intro" | "text" | "quote" | "heading" }> =>
          block.type === "intro" ||
          block.type === "text" ||
          block.type === "quote" ||
          block.type === "heading",
      );
      const descriptionSource =
        firstTextBlock?.text ??
        r.excerpt ??
        null;

      return {
        id: r.id,
        title: r.title,
        excerpt: r.excerpt,
        description: descriptionSource ? stripHtml(descriptionSource) : null,
        imageUrl:
          (r.coverImageId ? coverUrlById.get(r.coverImageId) ?? null : null) ||
          r.heroImage?.trim() ||
          r.seoOgImage?.trim() ||
          null,
        publishedAt: r.publishedAt.toISOString(),
        href: r.slug
          ? buildArticlePublicPath({
              slug: r.slug,
              geoScope: r.geoScope ?? undefined,
              citySlug: r.city?.slug ?? null,
            })
          : null,
      };
    });
}
