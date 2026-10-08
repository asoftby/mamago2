import assert from "node:assert/strict";
import {
  computeOpportunityScore,
  computeTrendDirection,
} from "./opportunityScore";
import {
  validatePlanItemGeo,
  SeoContentPlanValidationError,
  computePlanMix,
  isPublishedToActiveTransition,
} from "../plan/seoContentPlan.service";
import {
  planItemIdsForGeoScope,
  resolvePlanCreateGeoConfig,
} from "../plan/planCreateGeo";
import {
  presentSeoMarket,
  resolveSeoMarketFilter,
  enrichMarketFilterWithRegionCities,
  normalizeSearchQueryKey,
} from "../geo/seoMarket";
import { filterPagesByMarketFilter } from "../geo/filterPagesByGeoContext";
import type { SeoPage } from "../domain/types";

// opportunity
const high = computeOpportunityScore({
  searchesCurrent: 40,
  searchesPrevious: 20,
  zeroResultShare: 0.5,
});
assert.equal(high.tier, "high");

const neu = computeTrendDirection(5, 0);
assert.equal(neu.direction, "new");
assert.equal(neu.label, "Новое");

const up = computeTrendDirection(20, 10);
assert.equal(up.direction, "up");

assert.equal(normalizeSearchQueryKey("  Foo   Bar "), "foo bar");

// plan geo validation
assert.throws(
  () => validatePlanItemGeo({ geoScope: "CITY", cityId: null }),
  SeoContentPlanValidationError,
);
assert.throws(
  () => validatePlanItemGeo({ geoScope: "REGION", regionId: null }),
  SeoContentPlanValidationError,
);
assert.throws(
  () =>
    validatePlanItemGeo({
      geoScope: "REGION",
      regionId: "r1",
      cityId: "c1",
    }),
  SeoContentPlanValidationError,
);
assert.doesNotThrow(() =>
  validatePlanItemGeo({ geoScope: "CITY", cityId: "c1" }),
);
assert.doesNotThrow(() =>
  validatePlanItemGeo({ geoScope: "COUNTRY", cityId: null, regionId: null }),
);

// plan create geo by context
const cityCfg = resolvePlanCreateGeoConfig({
  contextKind: "city",
  cityName: "Минск",
  regionName: "Минская область",
  countryName: "Беларусь",
  cityId: "c1",
  regionId: "r1",
});
assert.equal(cityCfg.canCreate, true);
assert.equal(cityCfg.defaultGeo, "CITY");
assert.deepEqual(
  cityCfg.options.map((o) => o.value),
  ["CITY", "REGION"],
);

const regionCfg = resolvePlanCreateGeoConfig({
  contextKind: "region",
  cityName: null,
  regionName: "Брестская область",
  countryName: "Беларусь",
  cityId: null,
  regionId: "r2",
});
assert.equal(regionCfg.canCreate, true);
assert.equal(regionCfg.defaultGeo, "REGION");
assert.deepEqual(
  regionCfg.options.map((o) => o.value),
  ["REGION"],
);

const countryCfg = resolvePlanCreateGeoConfig({
  contextKind: "country",
  cityName: null,
  regionName: null,
  countryName: "Беларусь",
  cityId: null,
  regionId: null,
});
assert.equal(countryCfg.canCreate, true);
assert.equal(countryCfg.defaultGeo, "COUNTRY");
assert.deepEqual(planItemIdsForGeoScope("COUNTRY", { cityId: "x", regionId: "y" }), {
  cityId: null,
  regionId: null,
});

const allCfg = resolvePlanCreateGeoConfig({
  contextKind: "all",
  cityName: null,
  regionName: null,
  countryName: null,
  cityId: null,
  regionId: null,
});
assert.equal(allCfg.canCreate, false);
assert.match(allCfg.helperText ?? "", /Выберите город/);

// published → active reactivation gate (duplicate check required)
assert.equal(isPublishedToActiveTransition("PUBLISHED", "IDEA"), true);
assert.equal(isPublishedToActiveTransition("PUBLISHED", "PLANNED"), true);
assert.equal(isPublishedToActiveTransition("PUBLISHED", "IN_PROGRESS"), true);
assert.equal(isPublishedToActiveTransition("PUBLISHED", "PUBLISHED"), false);
assert.equal(isPublishedToActiveTransition("IDEA", "PLANNED"), false);
assert.equal(isPublishedToActiveTransition("PLANNED", "PUBLISHED"), false);

const mix = computePlanMix([
  { geoScope: "CITY" },
  { geoScope: "CITY" },
  { geoScope: "REGION" },
]);
assert.equal(mix.cityCount, 2);
assert.equal(mix.regionCount, 1);
assert.equal(mix.plannedTotal, 3);

// market filter pages — real Minsk shape: admin regionId null, SEO market mapped
const minsk = {
  kind: "city" as const,
  cityId: "c1",
  citySlug: "minsk",
  cityName: "Минск",
  regionId: null,
  regionName: null,
  seoMarketRegionId: "r1",
  seoMarketRegionName: "Минская область",
  countryId: "by",
  countryName: "Беларусь",
};
assert.equal(presentSeoMarket(minsk).marketLabel, "Минск + Минская область");
assert.equal(presentSeoMarket(minsk).supportsMarketScopes, true);

const market = enrichMarketFilterWithRegionCities(
  resolveSeoMarketFilter(minsk, "market"),
  [
    { id: "c2", slug: "zhodino" },
  ],
);

const pages: SeoPage[] = [
  {
    id: "a1",
    path: "/minsk/blog/a",
    section: "journal",
    type: "article",
    filtersSnapshot: { cityId: "c1", citySlug: "minsk", geoScope: "CITY" },
    title: "A",
    h1: "A",
    description: "",
    isIndexable: true,
    canonical: null,
    updatedAt: new Date().toISOString(),
    indexationStatus: "indexed",
  },
  {
    id: "a2",
    path: "/blog/region",
    section: "journal",
    type: "article",
    filtersSnapshot: {
      regionId: "r1",
      regionName: "Минская область",
      geoScope: "REGION",
    },
    title: "R",
    h1: "R",
    description: "",
    isIndexable: true,
    canonical: null,
    updatedAt: new Date().toISOString(),
    indexationStatus: "indexed",
  },
  {
    id: "a3",
    path: "/blog/by",
    section: "journal",
    type: "article",
    filtersSnapshot: { geoScope: "COUNTRY" },
    title: "C",
    h1: "C",
    description: "",
    isIndexable: true,
    canonical: null,
    updatedAt: new Date().toISOString(),
    indexationStatus: "indexed",
  },
];

const marketPages = filterPagesByMarketFilter(pages, market);
assert.equal(marketPages.length, 2);
assert.ok(marketPages.every((p) => p.id !== "a3"));

const cityPages = filterPagesByMarketFilter(
  pages,
  resolveSeoMarketFilter(minsk, "city"),
);
assert.equal(cityPages.length, 1);
assert.equal(cityPages[0]?.id, "a1");

console.log("seo content os contracts: PASS");
