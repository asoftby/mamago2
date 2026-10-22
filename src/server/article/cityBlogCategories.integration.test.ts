/** Run only against an explicitly isolated, migrated synthetic test database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { resolveCityBlogCategory, listPopulatedCityBlogCategories } from "./cityBlogCategories";
import sitemap from "@/app/sitemap";

async function main() {
  assert.equal(process.env.SEO_ISOLATED_TEST_DB, "true", "explicit isolated-test opt-in required");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "local test database only");
  assert.match(url.pathname, /^\/mamago_seo_[a-z0-9]+$/u, "dedicated SEO test database only");
  const appEnv = process.env.APP_ENV;
  try {
    process.env.APP_ENV = "dev";
    assert.deepEqual(await sitemap(), [], "DEV sitemap must stay empty with the release flag enabled");
  } finally {
    if (appEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = appEnv;
  }
  const city = await prisma.city.findFirstOrThrow({ where: { isActive: true, isLegacyNonCity: false } });
  const slug = `seo-null-robots-${randomUUID()}`;
  const category = await prisma.eventCategory.create({ data: { slug, nameRu: "Synthetic SEO category", nameEn: "Synthetic SEO category", publicationType: "ARTICLE" } });
  let articleId: string | undefined;
  try {
    const article = await prisma.article.create({ data: { slug, title: "Synthetic SEO article", status: "PUBLISHED", geoScope: "COUNTRY", publishedAt: new Date(), noindex: false, seoRobots: null, categoryId: category.id } });
    articleId = article.id;
    for (const seoRobots of [null, "index, follow", "noindex, follow", "NOINDEX,nofollow"]) {
      await prisma.article.update({ where: { id: article.id }, data: { seoRobots } });
      const expected = !seoRobots?.toLowerCase().includes("noindex");
      assert.equal(Boolean(await resolveCityBlogCategory(city, slug)), expected, `category resolution for ${seoRobots}`);
      assert.equal((await listPopulatedCityBlogCategories(city)).some((row) => row.id === category.id), expected);
      assert.equal((await sitemap()).some((row) => row.url.endsWith(`/${city.slug}/blog/category/${slug}`)), expected, "sitemap and page resolution must agree");
    }
  } finally {
    if (articleId) await prisma.article.delete({ where: { id: articleId } });
    await prisma.eventCategory.delete({ where: { id: category.id } });
  }
}
main().then(() => console.log("Nullable robots category/sitemap integration: OK")).catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
