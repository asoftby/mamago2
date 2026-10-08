import assert from "node:assert/strict";
import {
  allocateGeoMixTargets,
  buildGeoMixProgress,
  DEFAULT_GEO_CONTENT_MIX,
  filterPagesByGeoContext,
  filterPagesByMarketFilter,
  formatSeoGeoContextBreadcrumb,
  isSeoGeoContextToken,
  prismaGeoScopeToSeoKind,
  seoScopeKindToPrisma,
} from "./index";
import { buildSeoGeoCatalog } from "./loadSeoGeoCatalog";
import {
  enrichMarketFilterWithRegionCities,
  resolveSeoMarketFilter,
} from "./seoMarket";
import type { SeoPage } from "@/lib/admin/seo/domain/types";
import { buildSeoDashboardSummaryFromPages } from "@/lib/admin/seo/data/seoAdminData";

assert.equal(seoScopeKindToPrisma("NATIONAL"), "COUNTRY");
assert.equal(prismaGeoScopeToSeoKind("COUNTRY"), "NATIONAL");
assert.equal(prismaGeoScopeToSeoKind("CITY"), "CITY");
assert.ok(isSeoGeoContextToken("all"));
assert.ok(isSeoGeoContextToken("city:cm123"));
assert.equal(isSeoGeoContextToken("evil"), false);

const targets = allocateGeoMixTargets(10, DEFAULT_GEO_CONTENT_MIX);
assert.equal(targets.city, 7);
assert.equal(targets.region, 3);
assert.equal(targets.national, 0);

const progress = buildGeoMixProgress({
  plannedTotal: 10,
  actualCity: 7,
  actualRegion: 2,
  actualNational: 0,
});
assert.equal(progress.warnings.length, 1);
assert.match(progress.warnings[0]!, /региональных/);

const catalog = buildSeoGeoCatalog(
  [
    {
      id: "city-minsk",
      slug: "minsk",
      name: "Минск",
      regionId: null,
      countryId: "by",
      region: null,
      country: { id: "by", slug: "belarus", name: "Беларусь" },
    },
    {
      id: "city-brest",
      slug: "brest",
      name: "Брест",
      regionId: "reg-brest",
      countryId: "by",
      region: { id: "reg-brest", slug: "brestskaya-oblast", name: "Брестская область" },
      country: { id: "by", slug: "belarus", name: "Беларусь" },
    },
  ],
  [
    {
      id: "region_minskaya_oblast",
      slug: "minskaya-oblast",
      name: "Минская область",
      countryId: "by",
      country: { id: "by", slug: "belarus", name: "Беларусь" },
      // Administrative membership only — Minsk is intentionally absent.
      cities: [{ id: "city-zhodino", slug: "zhodino" }],
    },
    {
      id: "reg-brest",
      slug: "brestskaya-oblast",
      name: "Брестская область",
      countryId: "by",
      country: { id: "by", slug: "belarus", name: "Беларусь" },
      cities: [{ id: "city-brest", slug: "brest" }],
    },
  ],
);

assert.equal(catalog.defaultToken, "city:city-minsk");
const minsk = catalog.resolve("city:city-minsk");
assert.equal(minsk.kind, "city");
if (minsk.kind === "city") {
  assert.equal(minsk.regionId, null);
  assert.equal(minsk.seoMarketRegionId, "region_minskaya_oblast");
  assert.equal(
    formatSeoGeoContextBreadcrumb(minsk),
    "Беларусь / Минская область / Минск",
  );
}

const region = catalog.resolve("region:region_minskaya_oblast");
assert.equal(region.kind, "region");

const pages: SeoPage[] = [
  {
    id: "entity:place:1",
    path: "/minsk/places/a",
    section: "kuda",
    type: "place",
    filtersSnapshot: {
      entityId: "1",
      cityId: "city-minsk",
      citySlug: "minsk",
      geoScope: "CITY",
    },
    title: "A",
    h1: "A",
    description: "d",
    isIndexable: true,
    canonical: null,
    updatedAt: new Date().toISOString(),
    indexationStatus: "indexed",
    entityDiagnostics: {
      entityKind: "place",
      entityId: "1",
      entityTitle: "A",
      citySlug: "minsk",
      slug: "a",
      urlSegment: "a",
      publicPath: "/minsk/places/a",
      absolutePublicUrl: null,
      usesIdInUrl: false,
      canonicalIsSlugBased: true,
      contentStatus: "PUBLISHED",
      seoRobots: null,
      issues: ["Slug отсутствует"],
    },
  },
  {
    id: "entity:place:2",
    path: "/brest/places/b",
    section: "kuda",
    type: "place",
    filtersSnapshot: {
      entityId: "2",
      cityId: "city-brest",
      citySlug: "brest",
      geoScope: "CITY",
    },
    title: "B",
    h1: "B",
    description: "",
    isIndexable: true,
    canonical: null,
    updatedAt: new Date().toISOString(),
    indexationStatus: "indexed",
  },
  {
    id: "entity:article:region",
    path: "/blog/minsk-region",
    section: "journal",
    type: "article",
    filtersSnapshot: {
      entityId: "r1",
      regionId: "region_minskaya_oblast",
      regionName: "Минская область",
      geoScope: "REGION",
    },
    title: "R",
    h1: "R",
    description: "d",
    isIndexable: true,
    canonical: null,
    updatedAt: new Date().toISOString(),
    indexationStatus: "indexed",
  },
  {
    id: "entity:article:3",
    path: "/blog/national",
    section: "journal",
    type: "article",
    filtersSnapshot: {
      entityId: "3",
      geoScope: "COUNTRY",
      countryId: "by",
    },
    title: "N",
    h1: "N",
    description: "d",
    isIndexable: true,
    canonical: null,
    updatedAt: new Date().toISOString(),
    indexationStatus: "indexed",
  },
];

const minskPages = filterPagesByGeoContext(pages, minsk);
assert.equal(minskPages.length, 1);
assert.equal(minskPages[0]?.id, "entity:place:1");

// REGION context uses administrative membership — Minsk CITY pages are excluded.
const regionPages = filterPagesByGeoContext(pages, region);
assert.equal(regionPages.length, 1);
assert.equal(regionPages[0]?.id, "entity:article:region");

// MARKET for city:minsk uses SEO market region and includes Minsk + region content.
assert.ok(minsk.kind === "city");
const market = enrichMarketFilterWithRegionCities(
  resolveSeoMarketFilter(minsk, "market"),
  [{ id: "city-zhodino", slug: "zhodino" }],
);
const marketPages = filterPagesByMarketFilter(pages, market);
assert.deepEqual(
  marketPages.map((p) => p.id).sort(),
  ["entity:article:region", "entity:place:1"],
);

const country = catalog.resolve("country:by");
const countryPages = filterPagesByGeoContext(pages, country);
assert.equal(countryPages.length, 1);
assert.equal(countryPages[0]?.id, "entity:article:3");

const summary = buildSeoDashboardSummaryFromPages(minskPages);
assert.equal(summary.stats.find((s) => s.id === "pagesTotal")?.value, 1);
assert.equal(summary.stats.find((s) => s.id === "pagesWithIssues")?.value, 1);
assert.equal(summary.externalSourcesConnected, false);
assert.ok(summary.attentionItems.length >= 1);

console.log("seo geo foundation tests: PASS");
