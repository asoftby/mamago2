import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSeoGeoCatalog } from "./loadSeoGeoCatalog";
import {
  SEO_GEO_ALL_CITIES_VALUE,
  buildSeoGeoSelectorModel,
} from "./selectorModel";
import {
  enrichMarketFilterWithRegionCities,
  presentSeoMarket,
  resolveSeoMarketFilter,
} from "./seoMarket";
import { SEO_MARKET_REGION_BY_CITY_SLUG } from "./resolveSeoMarketRegion";

const country = { id: "by", slug: "belarus", name: "Беларусь" };
const catalog = buildSeoGeoCatalog(
  [
    {
      id: "minsk",
      slug: "minsk",
      name: "Минск",
      // Real seeded shape: administratively separate city.
      regionId: null,
      countryId: "by",
      region: null,
      country,
    },
    {
      id: "zhodino",
      slug: "zhodino",
      name: "Жодино",
      regionId: "region_minskaya_oblast",
      countryId: "by",
      region: {
        id: "region_minskaya_oblast",
        slug: "minskaya-oblast",
        name: "Минская область",
      },
      country,
    },
    {
      id: "brest",
      slug: "brest",
      name: "Брест",
      regionId: "brest-region",
      countryId: "by",
      region: {
        id: "brest-region",
        slug: "brestskaya-oblast",
        name: "Брестская область",
      },
      country,
    },
  ],
  [
    {
      id: "region_minskaya_oblast",
      slug: "minskaya-oblast",
      name: "Минская область",
      countryId: "by",
      country,
      cities: [{ id: "zhodino", slug: "zhodino" }],
    },
    {
      id: "brest-region",
      slug: "brestskaya-oblast",
      name: "Брестская область",
      countryId: "by",
      country,
      cities: [{ id: "brest", slug: "brest" }],
    },
  ],
);

assert.equal(SEO_MARKET_REGION_BY_CITY_SLUG.minsk, "minskaya-oblast");

const minskOption = catalog.options.find((o) => o.value === "city:minsk");
assert.ok(minskOption && minskOption.group === "city");
assert.equal(minskOption.regionId, null, "administrative City.regionId stays null");
assert.equal(minskOption.regionName, null);
assert.equal(minskOption.seoMarketRegionId, "region_minskaya_oblast");
assert.equal(minskOption.seoMarketRegionName, "Минская область");

const minskModel = buildSeoGeoSelectorModel("city:minsk", catalog.options);
assert.equal(minskModel.cityValue, "city:minsk");
assert.equal(minskModel.regionValue, "region:region_minskaya_oblast");
assert.deepEqual(
  minskModel.cities.map((city) => city.value).sort(),
  ["city:minsk", "city:zhodino"],
);

const minskContext = catalog.resolve(minskModel.cityValue);
assert.equal(minskContext.kind, "city");
if (minskContext.kind === "city") {
  assert.equal(minskContext.regionId, null);
  assert.equal(minskContext.regionName, null);
  assert.equal(minskContext.seoMarketRegionId, "region_minskaya_oblast");
  assert.equal(minskContext.seoMarketRegionName, "Минская область");
}
const minskPresentation = presentSeoMarket(minskContext);
assert.equal(minskPresentation.marketLabel, "Минск + Минская область");
assert.equal(minskPresentation.supportsMarketScopes, true);

const market = enrichMarketFilterWithRegionCities(
  resolveSeoMarketFilter(minskContext, "market"),
  [
    { id: "zhodino", slug: "zhodino" },
  ],
);
assert.equal(market.kind, "market");
if (market.kind === "market") {
  assert.equal(market.cityId, "minsk");
  assert.equal(market.regionId, "region_minskaya_oblast");
  assert.deepEqual(market.cityIds.sort(), ["minsk", "zhodino"]);
}

const brestModel = buildSeoGeoSelectorModel("city:brest", catalog.options);
assert.equal(
  brestModel.regionValue,
  "region:brest-region",
  "ordinary city still derives SEO market region from administrative regionId",
);
assert.notEqual(
  brestModel.regionValue,
  minskModel.regionValue,
  "an invalid city/region pair cannot persist",
);
const brestContext = catalog.resolve("city:brest");
assert.equal(brestContext.kind, "city");
if (brestContext.kind === "city") {
  assert.equal(brestContext.regionId, "brest-region");
  assert.equal(brestContext.seoMarketRegionId, "brest-region");
}

const regionModel = buildSeoGeoSelectorModel(
  "region:region_minskaya_oblast",
  catalog.options,
);
assert.equal(regionModel.cityValue, SEO_GEO_ALL_CITIES_VALUE);
assert.equal(regionModel.regionValue, "region:region_minskaya_oblast");
assert.deepEqual(
  regionModel.cities.map((city) => city.value).sort(),
  ["city:minsk", "city:zhodino"],
);
assert.equal(catalog.resolve(regionModel.regionValue).kind, "region");
assert.equal(catalog.resolve(regionModel.cities[0]!.value).kind, "city");

const subNav = readFileSync("src/components/admin/seo/SeoSubNav.tsx", "utf8");
const layoutHeader = readFileSync("src/components/admin/seo/SeoLayoutHeader.tsx", "utf8");
const selector = readFileSync("src/components/admin/seo/SeoGeoContextSelector.tsx", "utf8");

assert.match(subNav, /aria-current=\{active \? "page" : undefined\}/);
assert.match(subNav, /border-primary font-semibold text-primary/);
assert.doesNotMatch(subNav, /overflow-x-auto border-b border-gray-200/);
assert.doesNotMatch(subNav, /shadow-sm/);
assert.doesNotMatch(layoutHeader, /<header className="[^"]*border-b/);
assert.match(selector, /grid-cols-1 gap-2 sm:grid-cols-2/);
assert.match(selector, /aria-label="Город"/);
assert.match(selector, /aria-label="Регион"/);
assert.match(selector, /setContext\(model\.regionValue\)/, "all cities switches city context to REGION");

console.log("SEO admin geo selector contract: PASS");
