import prisma from "@/lib/prisma";
import { extractArticleMediaUsage, parseArticleContentJson } from "@/lib/publications/articleMvp";

export type ArticleMediaItem = {
  id: string;
  publicUrl: string;
  alt: string | null;
  title: string | null;
  usage: Array<"cover" | "seo" | "image-block" | "gallery-block">;
};

/**
 * «Фото этой статьи» — все MediaAsset, на которые ссылается статья (обложка,
 * legacy SEO-картинка, image/gallery блоки), с дедупликацией по id.
 * Namespace-agnostic по `uploadedById`: важно для migrated/legacy статей, где
 * старые файлы исторически принадлежат ADMIN, а не текущему authorUserId.
 * Возвращает `null`, если статья с таким id не существует.
 */
export async function getArticleMediaItems(articleId: string): Promise<ArticleMediaItem[] | null> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { coverImageId: true, seoImageId: true, contentJson: true },
  });
  if (!article) return null;

  const content = parseArticleContentJson(article.contentJson);
  const usageEntries = extractArticleMediaUsage({
    coverImageId: article.coverImageId,
    seoImageId: article.seoImageId,
    blocks: content.blocks,
  });

  if (usageEntries.length === 0) return [];

  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: usageEntries.map((entry) => entry.mediaId) } },
    select: { id: true, publicUrl: true, alt: true, title: true },
  });
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  const items: ArticleMediaItem[] = [];
  for (const entry of usageEntries) {
    const asset = assetById.get(entry.mediaId);
    if (!asset?.publicUrl) continue;
    items.push({
      id: asset.id,
      publicUrl: asset.publicUrl,
      alt: asset.alt,
      title: asset.title,
      usage: entry.usage,
    });
  }

  return items;
}
