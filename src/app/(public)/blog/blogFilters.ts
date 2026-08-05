import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";

export type BlogContentType = "ALL" | CityHomeJournalArticle["contentType"];

export function parseBlogContentType(value: string | null): BlogContentType {
  if (value === "article") return "ARTICLE";
  if (value === "news") return "NEWS";
  return "ALL";
}

export function getAvailableContentTypes(articles: CityHomeJournalArticle[]) {
  return new Set(articles.map((article) => article.contentType));
}

export function getArticlesForType(
  articles: CityHomeJournalArticle[],
  contentType: BlogContentType,
) {
  return contentType === "ALL"
    ? articles
    : articles.filter((article) => article.contentType === contentType);
}

export function getAvailableTags(articles: CityHomeJournalArticle[]) {
  const tags = new Map<string, CityHomeJournalArticle["tags"][number]>();
  for (const article of articles) {
    for (const tag of article.tags) tags.set(tag.slug, tag);
  }
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function filterBlogArticles(
  articles: CityHomeJournalArticle[],
  contentType: BlogContentType,
  tagSlug: string | null,
) {
  const byType = getArticlesForType(articles, contentType);
  return tagSlug
    ? byType.filter((article) => article.tags.some((tag) => tag.slug === tagSlug))
    : byType;
}
