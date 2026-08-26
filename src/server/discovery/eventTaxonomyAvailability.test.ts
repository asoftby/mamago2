import assert from "node:assert/strict";
import test from "node:test";
import { ContentStatus } from "@prisma/client";
import { filterTaxonomyByUsage, getAvailableEventTaxonomy } from "./eventTaxonomyAvailability";

const categories = [
  { id: "theatre-id", slug: "theatre", nameRu: "Спектакли", nameEn: null, icon: null, sortOrder: 1, genres: [
    { id: "puppet-id", slug: "puppet", name: "Кукольный", sortOrder: 1 },
    { id: "immersive-id", slug: "immersive", name: "Иммерсивный", sortOrder: 2 },
  ] },
  { id: "esports-id", slug: "esports", nameRu: "Киберспорт", nameEn: null, icon: null, sortOrder: 2, genres: [
    { id: "lan-id", slug: "lan", name: "LAN", sortOrder: 1 },
  ] },
];

test("categories and genres without public usage in the current scope are removed", () => {
  const usage = new Map([["theatre-id", new Set(["puppet"])]]);
  const result = filterTaxonomyByUsage(categories, usage);
  assert.deepEqual(result.map((category) => category.slug), ["theatre"]);
  assert.deepEqual(result[0]?.genres.map((genre) => genre.slug), ["puppet"]);
});

test("multiple used categories and genres are retained without cross-category slug leakage", () => {
  const usage = new Map([
    ["theatre-id", new Set(["puppet", "immersive"])],
    ["esports-id", new Set(["lan"])],
  ]);
  const result = filterTaxonomyByUsage(categories, usage);
  assert.deepEqual(result.map((category) => [category.slug, category.genres.map((genre) => genre.slug)]), [
    ["theatre", ["puppet", "immersive"]],
    ["esports", ["lan"]],
  ]);
});

test("availability uses canonical kuda visibility/city where and exactly two data queries", async () => {
  let activityQueries = 0;
  let taxonomyQueries = 0;
  let capturedWhere: unknown;
  const db = {
    activity: { findMany: async (args: { where: unknown }) => {
      activityQueries += 1;
      capturedWhere = args.where;
      return [{ eventCategoryId: "theatre-id", genreSlugs: ["puppet"] }];
    } },
    eventCategory: { findMany: async () => {
      taxonomyQueries += 1;
      return categories;
    } },
  };
  const result = await getAvailableEventTaxonomy("brest-id", "brest", db as never);
  const serializedWhere = JSON.stringify(capturedWhere);
  assert.equal(activityQueries, 1);
  assert.equal(taxonomyQueries, 1);
  assert.match(serializedWhere, /"type":"EVENT"/);
  assert.match(serializedWhere, /"cityId":"brest-id"/);
  assert.match(serializedWhere, new RegExp(ContentStatus.DRAFT));
  assert.match(serializedWhere, new RegExp(ContentStatus.DELETED));
  assert.deepEqual(result.map((category) => category.slug), ["theatre"]);
});

test("draft/hidden/other-city-only usage contributes nothing when canonical usage query returns no rows", async () => {
  const db = {
    activity: { findMany: async () => [] },
    eventCategory: { findMany: async () => { throw new Error("taxonomy query must be skipped"); } },
  };
  assert.deepEqual(await getAvailableEventTaxonomy("brest-id", "brest", db as never), []);
});
