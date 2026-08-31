import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// --- Regression guard: `/[city]/page.tsx` must load the city record exactly
// once and hand it to CityHomePage; CityHomePage must not re-query it. This
// pins the P0 fix for the duplicate findCityBySlug() call in the render path
// (route page + CityHomePage each doing their own lookup). ---

const pageSource = fs.readFileSync(
  path.join(__dirname, "..", "..", "..", "app", "(public)", "[city]", "page.tsx"),
  "utf8",
);
const cityHomeSource = fs.readFileSync(path.join(__dirname, "CityHomePage.tsx"), "utf8");

const pageLookupCount = (pageSource.match(/findCityBySlug\(/g) ?? []).length;
assert.equal(pageLookupCount, 1, `expected exactly one findCityBySlug() call in page.tsx, found ${pageLookupCount}`);

assert.ok(
  !cityHomeSource.includes("findCityBySlug"),
  "CityHomePage must receive the already-loaded city, not re-query findCityBySlug",
);

assert.ok(
  /<CityHomePage\s+city=\{city\}/.test(pageSource),
  "page.tsx must pass the loaded city record as the `city` prop",
);

console.log("CityHomePage duplicate-city-query test: OK");
