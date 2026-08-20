import assert from "node:assert/strict";

import { resolveArticleGeoHeaderLabel } from "./articleGeoHeaderLabel";

// 1. CITY Minsk article → header shows Минск
assert.equal(
  resolveArticleGeoHeaderLabel({ geoScope: "CITY", cityName: "Минск", regionName: null }),
  "Минск",
);

// 2. REGION Vitebskaya article → header shows Витебская область
assert.equal(
  resolveArticleGeoHeaderLabel({ geoScope: "REGION", cityName: null, regionName: "Витебская область" }),
  "Витебская область",
);

// 3. COUNTRY article → header shows Беларусь
assert.equal(
  resolveArticleGeoHeaderLabel({ geoScope: "COUNTRY", cityName: null, regionName: null }),
  "Беларусь",
);

// Defensive: REGION with no region row resolved (shouldn't happen — DB invariant — but never crash/blank)
assert.equal(
  resolveArticleGeoHeaderLabel({ geoScope: "REGION", cityName: null, regionName: null }),
  "Беларусь",
);

// Defensive: CITY with no city name resolved — never silently blank
assert.equal(
  resolveArticleGeoHeaderLabel({ geoScope: "CITY", cityName: null, regionName: null }),
  "Беларусь",
);

// Defensive: unset/legacy geoScope (null) never defaults to a city
assert.equal(
  resolveArticleGeoHeaderLabel({ geoScope: null, cityName: null, regionName: null }),
  "Беларусь",
);

console.log("articleGeoHeaderLabel tests: OK");
