import assert from "node:assert/strict";
import { buildNextPageParams, KUDA_LISTING_PAGE_SIZE, listingPageHref, paginateKudaFeed } from "./kudaListingPagination";
import {
  defaultFilters,
  discoveryFiltersSignature,
  parseAppliedFromUrl,
  resetListingPage,
  withImplicitListingFilters,
} from "@/features/filters/discovery/discoveryFilterParams";
import { serializeAppliedToSearchParams } from "@/features/filters/discovery/filters.store";
import { buildBudgetSearchParams } from "@/features/filters/discovery/useBudgetFilter";

assert.equal(KUDA_LISTING_PAGE_SIZE, 24);

const ids = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));
const partition = { primary: ids(30, "p"), secondary: ids(5, "s"), secondaryHeading: "Популярное у других семей" };

const p1 = paginateKudaFeed(partition, 1);
assert.equal(p1.total, 35);
assert.equal(p1.totalPages, 2);
assert.equal(p1.items.length, 24);
assert.equal(p1.offset, 1);
assert.ok(p1.items.every((item) => item.feedBucket === "primary"));

const p2 = paginateKudaFeed(partition, 2);
assert.equal(p2.items.length, 11);
assert.equal(p2.offset, 25);
assert.deepEqual(p2.items.map((i) => i.feedBucket), [...Array(6).fill("primary"), ...Array(5).fill("secondary")]);

// Pages concatenate to the exact feed order (no gaps, no duplicates).
const joined = [...p1.items, ...p2.items].map((i) => i.id);
assert.deepEqual(joined, [...partition.primary, ...partition.secondary].map((i) => i.id));

assert.equal(paginateKudaFeed(partition, 3).items.length, 0);
assert.equal(paginateKudaFeed(partition, 0).page, 1);
assert.equal(paginateKudaFeed({ primary: [], secondary: [], secondaryHeading: null }, 1).totalPages, 1);
assert.equal(paginateKudaFeed({ primary: ids(3, "p"), secondary: [], secondaryHeading: "x" }, 1).secondaryHeading, null);

assert.equal(listingPageHref("/minsk/events", "age=3-5&page=4", 1), "/minsk/events?age=3-5");
assert.equal(listingPageHref("/minsk/events", "age=3-5", 2), "/minsk/events?age=3-5&page=2");
assert.equal(listingPageHref("/minsk/events", "", 3), "/minsk/events?page=3");

// ── Category hub: route-implied category (Codex P1) ──────────────────────────
// Server: CityShell merges `category` from the route into the query it renders.
const hub = { category: "theatre" };
const serverSignature = discoveryFiltersSignature(
  parseAppliedFromUrl(new URLSearchParams({ category: hub.category })),
);
// Client on a clean hub URL: browser query has no `category`.
const clientApplied = parseAppliedFromUrl(new URLSearchParams(""));
assert.notEqual(discoveryFiltersSignature(clientApplied), serverSignature, "precondition: raw client filters differ");
assert.equal(
  discoveryFiltersSignature(withImplicitListingFilters(clientApplied, hub)),
  serverSignature,
  "effective client filters must match the server render (no endless skeleton)",
);
// With extra query filters on the hub the route category still wins, like the server.
const withAge = parseAppliedFromUrl(new URLSearchParams("age=3-5&category=circus"));
assert.deepEqual(withImplicitListingFilters(withAge, hub).categories, ["theatre"]);
assert.equal(
  discoveryFiltersSignature(withImplicitListingFilters(withAge, hub)),
  discoveryFiltersSignature(parseAppliedFromUrl(new URLSearchParams({ age: "3-5", category: hub.category }))),
);
assert.equal(withImplicitListingFilters(clientApplied, null), clientApplied);
// Next-page requests keep the hub category.
const next = buildNextPageParams("?age=3-5", { page: 2, citySlug: "minsk", implicitFilters: hub });
assert.equal(next.get("category"), "theatre");
assert.equal(next.get("page"), "2");
assert.equal(next.get("listingCity"), "minsk");
assert.equal(next.get("age"), "3-5");
assert.equal(buildNextPageParams("?category=circus", { page: 3, citySlug: "minsk" }).get("category"), "circus");

// ── Every filter write resets `page` (Codex P2) ──────────────────────────────
const onPage3 = new URLSearchParams("age=3-5&page=3&priceMax=80");
assert.equal(buildBudgetSearchParams(onPage3, 40).get("page"), null, "budget slider drops page");
assert.equal(buildBudgetSearchParams(onPage3, 40).get("priceMax"), "40");
assert.equal(buildBudgetSearchParams(onPage3, null).get("priceMax"), null);
assert.equal(buildBudgetSearchParams(new URLSearchParams("budget=50&page=2"), 30).get("budget"), null);
assert.equal(serializeAppliedToSearchParams(onPage3, { ...defaultFilters, age: ["3-5"] }).get("page"), null);
assert.equal(resetListingPage(new URLSearchParams("page=9&x=1")).toString(), "x=1");

// Other URL writers of discovery filters also go through resetListingPage.
import("node:fs").then(({ readFileSync }) => {
  for (const file of [
    "src/features/filters/discovery/useSecondaryFiltersFromUrl.ts",
    "src/features/filters/discovery/DiscoveryFilters.tsx",
    "src/features/filters/discovery/useBudgetFilter.ts",
    "src/features/filters/discovery/filters.store.ts",
  ]) {
    assert.match(readFileSync(file, "utf8"), /resetListingPage\(new URLSearchParams/, `${file} must reset page`);
  }
  const hubPage = readFileSync("src/app/(public)/[city]/events/category/[category]/page.tsx", "utf8");
  assert.match(hubPage, /implicitFilters=\{\{ category: hub\.category\.slug \}\}/);
});

console.log("Kuda listing pagination (24/page, stable order, buckets, hrefs, hub category, page reset): OK");
