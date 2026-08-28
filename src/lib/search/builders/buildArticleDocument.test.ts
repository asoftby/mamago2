import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

import { buildArticleDocument } from "./buildArticleDocument";

const baseArticle = {
  id: "article-1",
  slug: "family-weekend",
  title: "Family weekend",
  subtitle: null,
  excerpt: "Ideas for a weekend",
  seoTitle: null,
  seoDescription: null,
  publishedAt: new Date("2026-08-01T00:00:00.000Z"),
  heroImage: null,
  status: "PUBLISHED",
  geoScope: "CITY",
  cityId: "city-minsk",
  regionId: null,
  city: { slug: "minsk" },
} as const;

function fakeDb(article: unknown): PrismaClient {
  return {
    article: {
      findUnique: async () => article,
    },
  } as unknown as PrismaClient;
}

async function main() {
  const cityDocument = await buildArticleDocument(fakeDb(baseArticle), baseArticle.id);
  assert.equal(cityDocument?.urlPath, "/minsk/blog/family-weekend");
  assert.equal(cityDocument?.isPublished, true);

  const regionDocument = await buildArticleDocument(
    fakeDb({
      ...baseArticle,
      geoScope: "REGION",
      cityId: null,
      regionId: "region-minsk",
      city: null,
    }),
    baseArticle.id,
  );
  assert.equal(regionDocument?.urlPath, "/blog/family-weekend");

  const countryDocument = await buildArticleDocument(
    fakeDb({
      ...baseArticle,
      geoScope: "COUNTRY",
      cityId: null,
      regionId: null,
      city: null,
    }),
    baseArticle.id,
  );
  assert.equal(countryDocument?.urlPath, "/blog/family-weekend");

  const previousWarn = console.warn;
  let warning: unknown[] | null = null;
  console.warn = (...args: unknown[]) => {
    warning = args;
  };
  try {
    const invalidCityDocument = await buildArticleDocument(
      fakeDb({ ...baseArticle, cityId: null, city: null }),
      baseArticle.id,
    );
    assert.equal(invalidCityDocument, null, "invalid CITY article must be omitted from search");
    assert.ok(warning, "invalid geography must emit a diagnostic warning");
  } finally {
    console.warn = previousWarn;
  }

  console.log("buildArticleDocument geography tests: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
