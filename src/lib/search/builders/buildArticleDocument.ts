import type { PrismaClient } from "@prisma/client";
import { SEARCH_BOOST } from "@/lib/search/constants";
import { articleMetaLine } from "@/lib/search/metaLines";
import { buildSearchText, summarizeForSearchCard } from "@/lib/search/sanitizeSearchText";
import type { SearchDocUpsertFields } from "./buildActivityDocument";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";
import { validateArticleGeoScope } from "@/lib/article/articleGeoScopeValidation";

export async function buildArticleDocument(
  db: PrismaClient,
  articleId: string,
): Promise<SearchDocUpsertFields | null> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { city: { select: { slug: true } } },
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
  const geography = validateArticleGeoScope({
    geoScope: article.geoScope,
    cityId: article.cityId,
    regionId: article.regionId,
    strict: article.status === "PUBLISHED" || article.status === "PENDING" || article.status === "SCHEDULED",
  });
  if (!geography.ok || (article.geoScope === "CITY" && !article.city?.slug)) {
    console.warn("[buildArticleDocument] skipping article with invalid primary geography", {
      articleId: article.id,
      geoScope: article.geoScope,
      cityId: article.cityId,
      regionId: article.regionId,
    });
    return null;
  }
  const urlPath = buildArticlePublicPath({
    slug: slug || article.id,
    geoScope: article.geoScope,
    citySlug: article.city?.slug ?? null,
  });
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
