import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPlaceDetailPerfEnabled } from "./placeDetailPerf";

assert.equal(
  isPlaceDetailPerfEnabled({ APP_ENV: "production", DEBUG_PLACE_DETAIL_PERF: "true" }),
  false,
  "production must stay silent even if the debug flag is accidentally enabled",
);
assert.equal(
  isPlaceDetailPerfEnabled({ APP_ENV: "prod", DEBUG_PLACE_DETAIL_PERF: "true" }),
  false,
);
assert.equal(isPlaceDetailPerfEnabled({ APP_ENV: "dev" }), true);
assert.equal(isPlaceDetailPerfEnabled({ APP_ENV: "staging" }), true);
assert.equal(
  isPlaceDetailPerfEnabled({ APP_ENV: "dev", DEBUG_PLACE_DETAIL_PERF: "false" }),
  false,
  "DEV diagnostics must have an explicit kill switch",
);
assert.equal(
  isPlaceDetailPerfEnabled({ NODE_ENV: "development" }),
  true,
  "local development without APP_ENV should still be measurable",
);
assert.equal(
  isPlaceDetailPerfEnabled({ NODE_ENV: "production" }),
  false,
  "unknown production-like environments should default to silent",
);

const pageSource = readFileSync(
  "src/app/(public)/[city]/places/[slug]/page.tsx",
  "utf8",
);

assert.match(pageSource, /createPlaceDetailPerf\("page"\)/);
for (const stage of [
  "resolve",
  "placeCore",
  "relatedPlaces",
  "displayTitle",
  "media",
  "upcomingEvents",
  "offers",
  "reviews",
  "authPermissions",
  "openingHours",
  "directCta",
]) {
  assert.match(
    pageSource,
    new RegExp(`perf\\.mark\\("${stage}"\\)`),
    `Place detail page must record ${stage}`,
  );
}

const logBlock = pageSource.match(/perf\.log\(\{([\s\S]*?)\}\);/);
assert.ok(logBlock, "Place detail page must emit one summarized timing record");
const logBody = logBlock[1];
assert.match(logBody, /citySlug: placeCitySlug/);
assert.match(logBody, /relatedCount: relatedPlaces\.length/);
assert.match(logBody, /eventCount: upcomingEvents\.length/);
assert.match(logBody, /offerCount: activeOffers\.length/);
assert.match(logBody, /reviewCount: combinedReviews\.length/);
assert.match(logBody, /authenticated: Boolean\(currentUser\)/);
assert.doesNotMatch(logBody, /place\.id|currentUser\?\.id|ownerBusinessId|createdByUserId/);

console.log("place detail perf tests: OK");
