import type { PrismaClient } from "@prisma/client";
import { SEARCH_BOOST } from "@/lib/search/constants";
import { articleMetaLine } from "@/lib/search/metaLines";
import { buildSearchText, summarizeForSearchCard } from "@/lib/search/sanitizeSearchText";
import type { SearchDocUpsertFields } from "./buildActivityDocument";

export async function buildArticleDocument(
  db: PrismaClient,
  articleId: string,
): Promise<SearchDocUpsertFields | null> {
  const article = await db.article.findUnique({
    where: { id: articleId },
  });

  if (!article) return null;

  const searchText = buildSearchText([
    article.title,
    article.subtitle,
    article.excerpt,
    article.seoTitle,
    article.seoDescription,
  ]);

  const slug = article.slug?.trim();
  const urlPath = slug ? `/blog/${slug}` : `/blog/${article.id}`;
  const metaLine = articleMetaLine(article.publishedAt);
  const summaryLine = summarizeForSearchCard(article.subtitle ?? article.excerpt);
  const isPublished = article.status === "PUBLISHED" && Boolean(slug);

  return {
    entityType: "article",
    entityId: article.id,
    title: article.title,
    searchText: searchText || article.title,
    summaryLine,
    metaLine,
    imageUrl: article.heroImage,
    urlPath,
    isPublished,
    boost: SEARCH_BOOST.article,
  };
}
