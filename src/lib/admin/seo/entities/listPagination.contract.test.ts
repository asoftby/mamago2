import assert from "node:assert/strict";
import { planProviderPageWindows } from "./listFilters";
import { firstSearchParam } from "@/lib/admin/firstSearchParam";
import { buildSeoPagesListResult } from "@/lib/admin/seo/data/seoAdminData";
import type { SeoPage } from "@/lib/admin/seo/domain/types";

// ─── firstSearchParam ────────────────────────────────────────────────────────

assert.equal(firstSearchParam(undefined), undefined);
assert.equal(firstSearchParam("minsk"), "minsk");
assert.equal(firstSearchParam(["a", "b"]), "a");
assert.equal(firstSearchParam([]), undefined);

// Repeated search params must not reach .trim() as arrays
const q = firstSearchParam(["needle", "other"]);
assert.equal(typeof q?.trim(), "string");
assert.equal(q?.trim(), "needle");

const type = firstSearchParam(["place", "event"]);
assert.equal(type, "place");
const indexation = firstSearchParam(["noindex", "indexed"]);
assert.equal(indexation, "noindex");
const pageSize = firstSearchParam(["50", "100"]);
assert.equal(pageSize, "50");

// ─── planProviderPageWindows (registry-order concat) ─────────────────────────

// Providers: events=3, places=4, offers=2  → total 9
const counts = [3, 4, 2];

// page 1 size 25 → all from first providers that have data
assert.deepEqual(planProviderPageWindows(counts, 0, 25), [
  { providerIndex: 0, skip: 0, take: 3 },
  { providerIndex: 1, skip: 0, take: 4 },
  { providerIndex: 2, skip: 0, take: 2 },
]);

// page spanning event→place boundary (pageSize 4, skip 2)
assert.deepEqual(planProviderPageWindows(counts, 2, 4), [
  { providerIndex: 0, skip: 2, take: 1 },
  { providerIndex: 1, skip: 0, take: 3 },
]);

// page 2 across place→offer (skip 5, take 3)
assert.deepEqual(planProviderPageWindows(counts, 5, 3), [
  { providerIndex: 1, skip: 2, take: 2 },
  { providerIndex: 2, skip: 0, take: 1 },
]);

// last page (skip 7, take 25) → 2 remaining
assert.deepEqual(planProviderPageWindows(counts, 7, 25), [
  { providerIndex: 2, skip: 0, take: 2 },
]);

// beyond end
assert.deepEqual(planProviderPageWindows(counts, 100, 25), []);

// empty providers
assert.deepEqual(planProviderPageWindows([0, 0, 0], 0, 25), []);

// take 0
assert.deepEqual(planProviderPageWindows(counts, 0, 0), []);

// pageSize 50 / 100 still only ask for available rows
assert.deepEqual(planProviderPageWindows([10, 10], 0, 50), [
  { providerIndex: 0, skip: 0, take: 10 },
  { providerIndex: 1, skip: 0, take: 10 },
]);
assert.deepEqual(planProviderPageWindows([10, 10], 0, 100), [
  { providerIndex: 0, skip: 0, take: 10 },
  { providerIndex: 1, skip: 0, take: 10 },
]);

// ─── in-memory filters (geo / q / type / indexation / pageSize) ───────────────

function page(
  id: string,
  type: SeoPage["type"],
  extras: Partial<SeoPage> = {},
): SeoPage {
  return {
    id,
    path: `/minsk/${type}/${id}`,
    section: "kuda",
    type,
    filtersSnapshot: {
      cityId: "c1",
      citySlug: "minsk",
      geoScope: "CITY",
    },
    title: `Title ${id}`,
    h1: `H1 ${id}`,
    description: "d",
    isIndexable: true,
    canonical: null,
    updatedAt: new Date().toISOString(),
    indexationStatus: "indexed",
    ...extras,
  };
}

const catalog: SeoPage[] = [
  ...Array.from({ length: 3 }, (_, i) => page(`e${i}`, "event")),
  ...Array.from({ length: 4 }, (_, i) =>
    page(`p${i}`, "place", {
      indexationStatus: i % 2 === 0 ? "indexed" : "noindex",
      isIndexable: i % 2 === 0,
    }),
  ),
  page("o0", "offer", { title: "Birthday needle offer" }),
  page("r0", "route", {
    filtersSnapshot: {},
    path: "/routes/r0",
  }),
  page("a0", "article"),
];

const geoCity = {
  kind: "city" as const,
  cityId: "c1",
  citySlug: "minsk",
  cityName: "Минск",
  regionId: null,
  regionName: null,
  countryId: "by",
  countryName: "Беларусь",
};

const allCtx = { kind: "all" as const };

// total across geo city (route has no geo → excluded)
const cityList = buildSeoPagesListResult(catalog, geoCity, {
  page: 1,
  pageSize: 25,
});
assert.equal(cityList.pagination.total, 9); // 3e+4p+1o+1a (no route)
assert.equal(cityList.items.length, 9);

// type filter
const placesOnly = buildSeoPagesListResult(catalog, geoCity, {
  page: 1,
  pageSize: 25,
  type: "place",
});
assert.equal(placesOnly.pagination.total, 4);
assert.ok(placesOnly.items.every((r) => r.type === "place"));

// indexation filter
const noindex = buildSeoPagesListResult(catalog, geoCity, {
  page: 1,
  pageSize: 25,
  type: "place",
  indexation: "noindex",
});
assert.equal(noindex.pagination.total, 2);

// q filter
const qHit = buildSeoPagesListResult(catalog, geoCity, {
  page: 1,
  pageSize: 25,
  q: "needle",
});
assert.equal(qHit.pagination.total, 1);
assert.equal(qHit.items[0]?.id, "o0");

// Expand catalog to exercise pageSize 25 across pages
const bigCatalog: SeoPage[] = Array.from({ length: 60 }, (_, i) =>
  page(`big-${i}`, i % 2 === 0 ? "place" : "event"),
);

const p1 = buildSeoPagesListResult(bigCatalog, allCtx, { page: 1, pageSize: 25 });
assert.equal(p1.pagination.total, 60);
assert.equal(p1.items.length, 25);
assert.equal(p1.pagination.start, 1);
assert.equal(p1.pagination.end, 25);

const p2 = buildSeoPagesListResult(bigCatalog, allCtx, { page: 2, pageSize: 25 });
assert.equal(p2.items.length, 25);
assert.equal(p2.pagination.start, 26);
assert.equal(p2.pagination.end, 50);

const last = buildSeoPagesListResult(bigCatalog, allCtx, {
  page: 99,
  pageSize: 25,
});
assert.equal(last.pagination.page, 3);
assert.equal(last.items.length, 10);

const size50 = buildSeoPagesListResult(bigCatalog, allCtx, {
  page: 1,
  pageSize: 50,
});
assert.equal(size50.items.length, 50);
assert.equal(size50.pagination.totalPages, 2);
const size100 = buildSeoPagesListResult(bigCatalog, allCtx, {
  page: 1,
  pageSize: 100,
});
assert.equal(size100.items.length, 60);
assert.equal(size100.pagination.totalPages, 1);

console.log("seo entity list pagination contract: PASS");
