/**
 * Run: pnpm exec tsx src/server/geo/extractGeoFromGooglePlace.test.ts
 */
import assert from "node:assert/strict";
import { extractGeoFromGooglePlace } from "./extractGeoFromGooglePlace";
import type { GoogleAddressComponent } from "./extractGeoFromGooglePlace";

function comp(longName: string, types: string[], shortName?: string): GoogleAddressComponent {
  return { long_name: longName, short_name: shortName ?? longName, types };
}

// administrative_area_level_1 must NOT become city
const oblastOnly = extractGeoFromGooglePlace([
  comp("Минская область", ["administrative_area_level_1", "political"]),
  comp("Беларусь", ["country", "political"], "BY"),
]);
assert.equal(oblastOnly.cityName, null);
assert.equal(oblastOnly.regionName, "Минская область");
assert.equal(oblastOnly.needsReview, true);

// locality creates city candidate
const marina = extractGeoFromGooglePlace([
  comp("Марьина Горка", ["locality", "political"]),
  comp("Минская область", ["administrative_area_level_1", "political"]),
  comp("Беларусь", ["country", "political"], "BY"),
]);
assert.equal(marina.cityName, "Марьина Горка");
assert.equal(marina.regionName, "Минская область");
assert.equal(marina.countryCode, "BY");
assert.equal(marina.needsReview, false);

// administrative_area_level_2 rejected as city source
const rayonOnly = extractGeoFromGooglePlace([
  comp("Минский район", ["administrative_area_level_2", "political"]),
  comp("Минская область", ["administrative_area_level_1", "political"]),
]);
assert.equal(rayonOnly.cityName, null);
assert.ok(rayonOnly.rejectedAsCity.some((r) => r.types.includes("administrative_area_level_2")));

console.log("✅ extractGeoFromGooglePlace.test.ts — all assertions passed");
