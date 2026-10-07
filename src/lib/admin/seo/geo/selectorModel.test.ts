import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSeoGeoCatalog } from "./loadSeoGeoCatalog";
import {
  SEO_GEO_ALL_CITIES_VALUE,
  buildSeoGeoSelectorModel,
} from "./selectorModel";
import { presentSeoMarket } from "./seoMarket";

const country = { id: "by", slug: "belarus", name: "Беларусь" };
const catalog = buildSeoGeoCatalog(
  [
    {
      id: "minsk",
      slug: "minsk",
      name: "Минск",
      regionId: "minsk-region",
      countryId: "by",
      region: { id: "minsk-region", slug: "minskaya", name: "Минская область" },
      country,
    },
    {
      id: "brest",
      slug: "brest",
      name: "Брест",
      regionId: "brest-region",
      countryId: "by",
      region: { id: "brest-region", slug: "brestskaya", name: "Брестская область" },
      country,
    },
  ],
  [
    {
      id: "minsk-region",
      slug: "minskaya",
      name: "Минская область",
      countryId: "by",
      country,
      cities: [{ id: "minsk", slug: "minsk" }],
    },
    {
      id: "brest-region",
      slug: "brestskaya",
      name: "Брестская область",
      countryId: "by",
      country,
      cities: [{ id: "brest", slug: "brest" }],
    },
  ],
);

const minskModel = buildSeoGeoSelectorModel("city:minsk", catalog.options);
assert.equal(minskModel.cityValue, "city:minsk");
assert.equal(minskModel.regionValue, "region:minsk-region");
assert.deepEqual(minskModel.cities.map((city) => city.value), ["city:minsk"]);

const minskContext = catalog.resolve(minskModel.cityValue);
assert.equal(presentSeoMarket(minskContext).marketLabel, "Минск + Минская область");

const brestModel = buildSeoGeoSelectorModel("city:brest", catalog.options);
assert.equal(brestModel.regionValue, "region:brest-region", "changing city must derive its region");
assert.notEqual(brestModel.regionValue, minskModel.regionValue, "an invalid city/region pair cannot persist");

const regionModel = buildSeoGeoSelectorModel("region:minsk-region", catalog.options);
assert.equal(regionModel.cityValue, SEO_GEO_ALL_CITIES_VALUE);
assert.equal(regionModel.regionValue, "region:minsk-region");
assert.deepEqual(regionModel.cities.map((city) => city.value), ["city:minsk"]);
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
