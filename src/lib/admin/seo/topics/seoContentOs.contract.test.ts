import assert from "node:assert/strict";
import {
  computeOpportunityScore,
  computeTrendDirection,
} from "./opportunityScore";
import {
  validatePlanItemGeo,
  SeoContentPlanValidationError,
  computePlanMix,
} from "../plan/seoContentPlan.service";
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

const mix = computePlanMix([
  { geoScope: "CITY" },
  { geoScope: "CITY" },
  { geoScope: "REGION" },
]);
assert.equal(mix.cityCount, 2);
assert.equal(mix.regionCount, 1);
assert.equal(mix.plannedTotal, 3);

// market filter pages
const minsk = {
  kind: "city" as const,
  cityId: "c1",
  citySlug: "minsk",
  cityName: "Минск",
  regionId: "r1",
  regionName: "Минская область",
  countryId: "by",
  countryName: "Беларусь",
};
assert.equal(presentSeoMarket(minsk).marketLabel, "Минск + Минская область");

const market = enrichMarketFilterWithRegionCities(
  resolveSeoMarketFilter(minsk, "market"),
  [
    { id: "c1", slug: "minsk" },
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
