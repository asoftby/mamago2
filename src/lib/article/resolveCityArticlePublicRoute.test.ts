/**
 * CITY article public route resolution tests.
 * Run: set -a; source .env; set +a; pnpm exec tsx src/lib/article/resolveCityArticlePublicRoute.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import prisma from "@/lib/prisma";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";
import { resolveCityArticlePublicRoute } from "./resolveCityArticlePublicRoute";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";

const pageSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "app",
    "(public)",
    "[city]",
    "blog",
    "[slug]",
    "page.tsx",
  ),
  "utf8",
);

assert.match(
  pageSource,
  /resolveCityArticlePublicRoute/,
  "city blog page must resolve slug history through resolveCityArticlePublicRoute",
);
assert.match(
  pageSource,
  /route\.canonicalSlug/,
  "city blog metadata must use canonical slug after route resolution",
);

async function getMinskCity() {
  const city = await prisma.city.findFirst({
    where: { slug: "minsk", isActive: true },
    select: { id: true, slug: true, name: true },
  });
  assert.ok(city, "expected active minsk city in local DB");
  return city;
}

async function testCurrentSlugRenders() {
  const city = await getMinskCity();
  const article = await prisma.article.findFirst({
    where: {
      ...getPublicPublishedArticleWhere(),
      geoScope: "CITY",
      cityId: city.id,
      slug: { not: null },
    },
    select: { id: true, slug: true },
    orderBy: { publishedAt: "desc" },
  });
  assert.ok(article?.slug, "expected at least one published CITY article");

  const resolution = await resolveCityArticlePublicRoute(article.slug, city);
  assert.equal(resolution.kind, "ok");
  if (resolution.kind !== "ok") return;
  assert.equal(resolution.canonicalSlug, article.slug);
  assert.equal(resolution.isHistoricalSlug, false);
}

async function testHistoricalSlugRedirectsToCurrent() {
  const city = await getMinskCity();
  const suffix = Date.now().toString(36);
  const currentSlug = `city-route-current-${suffix}`;
  const historicalSlug = `city-route-old-${suffix}`;

  const article = await prisma.article.create({
    data: {
      title: "City route historical slug test",
      slug: currentSlug,
      cityId: city.id,
      geoScope: "CITY",
      status: "PUBLISHED",
      publishedAt: new Date(),
      contentJson: {
        version: 1,
        blocks: [{ id: "b1", type: "text", text: "Regression test paragraph." }],
      },
    },
    select: { id: true },
  });

  try {
    await prisma.articleSlugHistory.create({
      data: {
        articleId: article.id,
        slug: historicalSlug,
        cityId: city.id,
      },
    });

    const resolution = await resolveCityArticlePublicRoute(historicalSlug, city);
    assert.equal(resolution.kind, "canonical_redirect");
    if (resolution.kind !== "canonical_redirect") return;
    assert.equal(
      resolution.path,
      buildCityPublicPath({ citySlug: city.slug, type: "article", slug: currentSlug }),
    );
  } finally {
    await prisma.articleSlugHistory.deleteMany({ where: { articleId: article.id } });
    await prisma.article.delete({ where: { id: article.id } });
  }
}

async function testUnknownSlugNotFound() {
  const city = await getMinskCity();
  const resolution = await resolveCityArticlePublicRoute(
    `missing-city-article-${Date.now()}`,
    city,
  );
  assert.equal(resolution.kind, "not_found");
}

async function testDraftHistoricalSlugNotFound() {
  const city = await getMinskCity();
  const suffix = Date.now().toString(36);
  const currentSlug = `city-route-draft-current-${suffix}`;
  const historicalSlug = `city-route-draft-old-${suffix}`;

  const article = await prisma.article.create({
    data: {
      title: "City route draft historical slug test",
      slug: currentSlug,
      cityId: city.id,
      geoScope: "CITY",
      status: "DRAFT",
      contentJson: {
        version: 1,
        blocks: [{ id: "b1", type: "text", text: "Draft regression test." }],
      },
    },
    select: { id: true },
  });

  try {
    await prisma.articleSlugHistory.create({
      data: {
        articleId: article.id,
        slug: historicalSlug,
        cityId: city.id,
      },
    });

    const resolution = await resolveCityArticlePublicRoute(historicalSlug, city);
    assert.equal(resolution.kind, "not_found");
  } finally {
    await prisma.articleSlugHistory.deleteMany({ where: { articleId: article.id } });
    await prisma.article.delete({ where: { id: article.id } });
  }
}

async function testOtherCityHistoricalSlugNotFound() {
  const minsk = await getMinskCity();
  const otherCity = await prisma.city.findFirst({
    where: { isActive: true, slug: { not: "minsk" } },
    select: { id: true, slug: true },
  });
  if (!otherCity) {
    console.log("skip: no secondary active city for cross-city historical slug test");
    return;
  }

  const suffix = Date.now().toString(36);
  const currentSlug = `city-route-other-current-${suffix}`;
  const historicalSlug = `city-route-other-old-${suffix}`;

  const article = await prisma.article.create({
    data: {
      title: "City route other-city historical slug test",
      slug: currentSlug,
      cityId: otherCity.id,
      geoScope: "CITY",
      status: "PUBLISHED",
      publishedAt: new Date(),
      contentJson: {
        version: 1,
        blocks: [{ id: "b1", type: "text", text: "Other city regression test." }],
      },
    },
    select: { id: true },
  });

  try {
    await prisma.articleSlugHistory.create({
      data: {
        articleId: article.id,
        slug: historicalSlug,
        cityId: otherCity.id,
      },
    });

    const resolution = await resolveCityArticlePublicRoute(historicalSlug, minsk);
    assert.equal(resolution.kind, "not_found");
  } finally {
    await prisma.articleSlugHistory.deleteMany({ where: { articleId: article.id } });
    await prisma.article.delete({ where: { id: article.id } });
  }
}

async function main() {
  await testCurrentSlugRenders();
  await testHistoricalSlugRedirectsToCurrent();
  await testUnknownSlugNotFound();
  await testDraftHistoricalSlugNotFound();
  await testOtherCityHistoricalSlugNotFound();
  console.log("resolveCityArticlePublicRoute.test.ts: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
