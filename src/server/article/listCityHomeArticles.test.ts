/**
 * Integration tests for REGION-scope discovery in listCityHomeArticles:
 * city journal prioritizes local/regional articles but still exposes articles
 * from every Belarusian city and region with canonical links and labels.
 * Self-generated fixtures (2 cities + 1 article), cleaned up in a finally
 * block. Exercises the real DB projection without requiring Next incremental
 * cache context.
 *
 * Run: set -a; source .env; set +a; npx tsx src/server/article/listCityHomeArticles.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { queryCityHomeArticles } from "./listCityHomeArticles";

async function main() {
  const marker = randomUUID();
  const createdCityIds: string[] = [];
  const createdArticleIds: string[] = [];

  try {
    const vitebskOblast = await prisma.region.findFirst({
      where: { slug: "vitebskaya-oblast" },
      select: { id: true, countryId: true },
    });
    const gomelOblast = await prisma.region.findFirst({
      where: { slug: "gomelskaya-oblast" },
      select: { id: true },
    });
    assert.ok(vitebskOblast, "vitebskaya-oblast region must exist (seed.ts) — run `pnpm db:seed:system`");
    assert.ok(gomelOblast, "gomelskaya-oblast region must exist (seed.ts) — run `pnpm db:seed:system`");
    const category = await prisma.eventCategory.findFirst({
      where: { publicationType: "ARTICLE", isActive: true, archivedAt: null },
      select: { id: true },
    });
    assert.ok(category, "an active journal category must exist");

    const cityInVitebskRegion = await prisma.city.create({
      data: {
        countryId: vitebskOblast.countryId,
        regionId: vitebskOblast.id,
        name: `Test City Vitebsk ${marker}`,
        slug: `test-city-vitebsk-${marker}`,
      },
      select: { id: true, slug: true, name: true, regionId: true },
    });
    createdCityIds.push(cityInVitebskRegion.id);

    const cityInGomelRegion = await prisma.city.create({
      data: {
        countryId: vitebskOblast.countryId,
        regionId: gomelOblast.id,
        name: `Test City Gomel ${marker}`,
        slug: `test-city-gomel-${marker}`,
      },
      select: { id: true, slug: true, name: true, regionId: true },
    });
    createdCityIds.push(cityInGomelRegion.id);

    const regionArticle = await prisma.article.create({
      data: {
        title: `Braslav region article ${marker}`,
        categoryId: category.id,
        slug: `braslav-region-article-${marker}`,
        geoScope: "REGION",
        regionId: vitebskOblast.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    createdArticleIds.push(regionArticle.id);

    const primaryCity = await prisma.city.create({
      data: {
        countryId: vitebskOblast.countryId,
        regionId: vitebskOblast.id,
        name: `Primary City ${marker}`,
        slug: `primary-city-${marker}`,
      },
      select: { id: true, slug: true },
    });
    createdCityIds.push(primaryCity.id);
    const additionalArticle = await prisma.article.create({
      data: {
        title: `Additional geography article ${marker}`,
        categoryId: category.id,
        slug: `additional-geography-${marker}`,
        geoScope: "CITY",
        cityId: primaryCity.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
        additionalGeographyTargets: { create: [
          { type: "CITY", cityId: cityInGomelRegion.id, position: 0 },
          { type: "REGION", regionId: gomelOblast.id, position: 1 },
        ] },
      },
      select: { id: true },
    });
    createdArticleIds.push(additionalArticle.id);

    // Visible for a city in the SAME region.
    const forVitebskCity = await queryCityHomeArticles(cityInVitebskRegion, { take: 1000 });
    assert.ok(
      forVitebskCity.some((a) => a.id === regionArticle.id),
      "REGION article must be visible for a city in the same region",
    );
    const matched = forVitebskCity.find((a) => a.id === regionArticle.id);
    assert.equal(matched?.href, `/blog/braslav-region-article-${marker}`, "REGION article href = /blog/{slug}");

    // Also visible to readers from other Belarusian cities, but ranked last.
    const forGomelCity = await queryCityHomeArticles(cityInGomelRegion, { take: 1000 });
    const crossRegion = forGomelCity.find((a) => a.id === regionArticle.id);
    assert.ok(crossRegion, "a regional article must remain discoverable throughout Belarus");
    assert.equal(crossRegion.geographyGroup, "BELARUS");
    assert.equal(crossRegion.href, `/blog/braslav-region-article-${marker}`);
    const additionalMatches = forGomelCity.filter((a) => a.id === additionalArticle.id);
    assert.equal(additionalMatches.length, 1, "multiple matching additional targets must return one article");
    assert.equal(additionalMatches[0]?.geographyGroup, "CITY", "targeted-city publication ranks locally");
    assert.ok(forGomelCity.indexOf(additionalMatches[0]) < forGomelCity.indexOf(crossRegion!), "local entries precede other regions");
    assert.equal(
      additionalMatches[0]?.href,
      `/${primaryCity.slug}/blog/additional-geography-${marker}`,
      "an additionally discovered article must keep its primary CITY URL",
    );

    console.log("listCityHomeArticles REGION discovery tests: OK");
  } finally {
    await prisma.article.deleteMany({ where: { id: { in: createdArticleIds } } });
    await prisma.city.deleteMany({ where: { id: { in: createdCityIds } } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
