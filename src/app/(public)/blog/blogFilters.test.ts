import assert from "node:assert/strict";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import {
  filterBlogArticles,
  getArticlesForType,
  getAvailableContentTypes,
  getAvailableTags,
  parseBlogContentType,
} from "./blogFilters";

function article(
  slug: string,
  contentType: CityHomeJournalArticle["contentType"],
  tags: CityHomeJournalArticle["tags"],
): CityHomeJournalArticle {
  return {
    id: `id-${slug}`,
    slug,
    href: `/minsk/blog/${slug}`,
    title: slug,
    subtitle: null,
    contentType,
    category: null,
    tags,
    readTime: 3,
    isBreakingNews: contentType === "NEWS",
    publishedAt: new Date("2026-01-01"),
    coverImageUrl: null,
  };
}

const animals = { id: "animals", slug: "animals", name: "Животные" };
const culture = { id: "culture", slug: "culture", name: "Культура" };
const articles = [
  article("article-animals", "ARTICLE", [animals]),
  article("article-culture", "ARTICLE", [culture]),
  article("news-culture", "NEWS", [culture]),
];

assert.equal(parseBlogContentType("article"), "ARTICLE");
assert.equal(parseBlogContentType("news"), "NEWS");
assert.equal(parseBlogContentType("unknown"), "ALL");
assert.deepEqual([...getAvailableContentTypes(articles)].sort(), ["ARTICLE", "NEWS"]);
assert.deepEqual(getArticlesForType(articles, "NEWS").map((item) => item.slug), ["news-culture"]);
assert.deepEqual(getAvailableTags(getArticlesForType(articles, "NEWS")), [culture]);
assert.deepEqual(
  filterBlogArticles(articles, "ARTICLE", "animals").map((item) => item.slug),
  ["article-animals"],
);
assert.deepEqual(
  filterBlogArticles(articles, "ARTICLE", null).map((item) => item.slug),
  ["article-animals", "article-culture"],
);

console.log("✅ blogFilters.test.ts");
