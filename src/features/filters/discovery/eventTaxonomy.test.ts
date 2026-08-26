import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { defaultFilters } from "./filters.store";
import { eventTaxonomyCacheKey, normalizeDraftToAvailableTaxonomy, toggleEventCategory, type EventCategoryOption } from "./eventTaxonomy";

const taxonomy: EventCategoryOption[] = [
  { id: "1", slug: "theatre", nameRu: "Спектакли", nameEn: null, icon: null, sortOrder: 1, genres: [{ id: "g1", slug: "puppet", nameRu: "Кукольный", sortOrder: 1 }] },
  { id: "2", slug: "workshops", nameRu: "Мастер-классы", nameEn: null, icon: null, sortOrder: 2, genres: [{ id: "g2", slug: "cooking", nameRu: "Кулинарный", sortOrder: 1 }] },
];

test("two selected categories expose both genre groups", () => {
  const selected = taxonomy.filter((category) => ["theatre", "workshops"].includes(category.slug));
  assert.deepEqual(selected.map((category) => category.genres[0]?.slug), ["puppet", "cooking"]);
});

test("removing a category removes only genres no longer owned by selected categories", () => {
  const draft = { ...defaultFilters, categories: ["theatre", "workshops"], genres: ["puppet", "cooking"] };
  assert.deepEqual(toggleEventCategory(draft, "theatre", taxonomy), {
    ...defaultFilters,
    categories: ["workshops"],
    genres: ["cooking"],
  });
});

test("adding a category is multi-select and preserves selected genres", () => {
  const draft = { ...defaultFilters, categories: ["theatre"], genres: ["puppet"] };
  assert.deepEqual(toggleEventCategory(draft, "workshops", taxonomy).categories, ["theatre", "workshops"]);
  assert.deepEqual(toggleEventCategory(draft, "workshops", taxonomy).genres, ["puppet"]);
});

test("advanced modal keeps URL writes behind apply while using read-only live previews", () => {
  const source = readFileSync(new URL("../../../components/discovery/EventAdvancedFilters.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("actions.setDraft"), false);
  assert.equal(source.includes("/api/discovery/events/count"), true);
  assert.equal(source.includes("/api/discovery/events/price-distribution"), true);
  assert.equal(source.match(/actions\.commitFilters\(/g)?.length, 1);
});

test("taxonomy cache key is normalized and city-scoped", () => {
  assert.equal(eventTaxonomyCacheKey(" Minsk "), "minsk");
  assert.notEqual(eventTaxonomyCacheKey("minsk"), eventTaxonomyCacheKey("brest"));
});

test("unavailable deep-link category and orphan genre are ignored safely", () => {
  const normalized = normalizeDraftToAvailableTaxonomy(
    { ...defaultFilters, categories: ["esports", "theatre"], genres: ["lan", "puppet"] },
    taxonomy,
  );
  assert.deepEqual(normalized.categories, ["theatre"]);
  assert.deepEqual(normalized.genres, ["puppet"]);
});
