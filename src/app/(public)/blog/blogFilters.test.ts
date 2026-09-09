import assert from "node:assert/strict";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import {
  filterBlogArticles,
  getArticlesForType,
  getAvailableCategories,
  getAvailableContentTypes,
  getAvailableTags,
  parseBlogContentType,
  parseBlogPage,
  sortBlogArticlesNewestFirst,
} from "./blogFilters";

function article(
  slug: string,
  contentType: CityHomeJournalArticle["contentType"],
  tags: CityHomeJournalArticle["tags"],
  category: CityHomeJournalArticle["category"],
  publishedAt: string,
): CityHomeJournalArticle {
  return {
    id: `id-${slug}`,
    slug,
    href: `/minsk/blog/${slug}`,
    title: slug,
    subtitle: null,
    contentType,
    category,
    tags,
    readTime: 3,
    isBreakingNews: contentType === "NEWS",
    publishedAt: new Date(publishedAt),
    coverImageUrl: null,
  };
}

const animals = { id: "animals", slug: "animals", name: "Животные" };
const culture = { id: "culture", slug: "culture", name: "Культура" };
const guides = { id: "guides", slug: "guides", name: "Гайды" };
const reviews = { id: "reviews", slug: "reviews", name: "Обзоры" };
const articles = [
  article("article-animals", "ARTICLE", [animals], guides, "2026-01-03"),
  article("article-culture", "ARTICLE", [culture], reviews, "2026-01-05"),
  article("news-culture", "NEWS", [culture], reviews, "2026-01-04"),
];

assert.equal(parseBlogContentType("article"), "ARTICLE");
assert.equal(parseBlogContentType("news"), "NEWS");
assert.equal(parseBlogContentType("unknown"), "ALL");
assert.equal(parseBlogPage("3"), 3);
assert.equal(parseBlogPage("0"), 1);
assert.equal(parseBlogPage("nope"), 1);
assert.deepEqual([...getAvailableContentTypes(articles)].sort(), ["ARTICLE", "NEWS"]);
assert.deepEqual(getArticlesForType(articles, "NEWS").map((item) => item.slug), ["news-culture"]);
assert.deepEqual(getAvailableTags(getArticlesForType(articles, "NEWS")), [culture]);
assert.deepEqual(getAvailableCategories(articles), [guides, reviews]);
assert.deepEqual(
  sortBlogArticlesNewestFirst(articles).map((item) => item.slug),
  ["article-culture", "news-culture", "article-animals"],
);
assert.deepEqual(
  filterBlogArticles(articles, "ARTICLE", "guides", "animals").map((item) => item.slug),
  ["article-animals"],
);
assert.deepEqual(
  filterBlogArticles(articles, "ARTICLE", "reviews", null).map((item) => item.slug),
  ["article-culture"],
);
assert.deepEqual(
  filterBlogArticles(articles, "ARTICLE", null, null).map((item) => item.slug),
  ["article-culture", "article-animals"],
);

console.log("✅ blogFilters.test.ts");
