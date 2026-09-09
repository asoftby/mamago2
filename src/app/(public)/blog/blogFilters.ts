import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";

export type BlogContentType = "ALL" | CityHomeJournalArticle["contentType"];

export function parseBlogContentType(value: string | null): BlogContentType {
  if (value === "article") return "ARTICLE";
  if (value === "news") return "NEWS";
  return "ALL";
}

export function parseBlogPage(value: string | null): number {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
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

export function getAvailableCategories(articles: CityHomeJournalArticle[]) {
  const categories = new Map<
    string,
    NonNullable<CityHomeJournalArticle["category"]>
  >();

  for (const article of articles) {
    if (article.category) categories.set(article.category.slug, article.category);
  }

  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function getAvailableTags(articles: CityHomeJournalArticle[]) {
  const tags = new Map<string, CityHomeJournalArticle["tags"][number]>();
  for (const article of articles) {
    for (const tag of article.tags) tags.set(tag.slug, tag);
  }
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function publicationTimestamp(value: Date | string | null): number {
  if (!value) return 0;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortBlogArticlesNewestFirst(
  articles: CityHomeJournalArticle[],
): CityHomeJournalArticle[] {
  return [...articles].sort((left, right) => {
    const leftPublishedAt = publicationTimestamp(left.publishedAt);
    const rightPublishedAt = publicationTimestamp(right.publishedAt);
    if (leftPublishedAt !== rightPublishedAt) return rightPublishedAt - leftPublishedAt;
    return right.id.localeCompare(left.id);
  });
}

export function filterBlogArticles(
  articles: CityHomeJournalArticle[],
  contentType: BlogContentType,
  categorySlug: string | null,
  tagSlug: string | null,
) {
  const byType = getArticlesForType(articles, contentType);
  const byCategory = categorySlug
    ? byType.filter((article) => article.category?.slug === categorySlug)
    : byType;
  const filtered = tagSlug
    ? byCategory.filter((article) => article.tags.some((tag) => tag.slug === tagSlug))
    : byCategory;

  return sortBlogArticlesNewestFirst(filtered);
}
