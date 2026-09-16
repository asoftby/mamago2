import assert from "node:assert/strict";
import {
  getLegacyEditorialRouteArticlePath,
  isLegacyEditorialRouteSlug,
  LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG,
  LEGACY_EDITORIAL_ROUTE_SLUGS,
} from "./legacyEditorialRouteCutover";

assert.equal(LEGACY_EDITORIAL_ROUTE_SLUGS.length, 13);
assert.equal(new Set(LEGACY_EDITORIAL_ROUTE_SLUGS).size, 13);
assert.equal(LEGACY_EDITORIAL_ROUTE_SLUGS.includes(LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG as never), false);

for (const slug of LEGACY_EDITORIAL_ROUTE_SLUGS) {
  assert.equal(isLegacyEditorialRouteSlug(slug), true);
  assert.equal(getLegacyEditorialRouteArticlePath(slug), `/minsk/blog/${slug}`);
}

assert.equal(isLegacyEditorialRouteSlug(LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG), false);
assert.equal(getLegacyEditorialRouteArticlePath(LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG), null);
assert.equal(getLegacyEditorialRouteArticlePath("some-future-ugc-route"), null);

console.log("legacyEditorialRouteCutover.test.ts: PASS");
