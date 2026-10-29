import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("SSR and infinite-scroll listing use the existing uncapped ranked feed, not a 360-item pool", () => {
  const listing = readFileSync("src/server/discovery/kudaListingPage.ts", "utf8");
  const feed = readFileSync("src/server/discovery/kudaDiscoveryFeed.ts", "utf8");
  assert.doesNotMatch(listing, /KUDA_LISTING_POOL/);
  assert.match(listing, /allCandidates:\s*true/);
  assert.match(listing, /hydrateImages:\s*false/);
  assert.match(feed, /!options\?\.allCandidates\s*\?\s*\{\s*take:/);
  assert.match(listing, /paginateKudaFeed\(partition,/);
  assert.match(listing, /withImageDimensions\(hydrated,/);
  assert.match(listing, /page\.items\.filter\(item => byId\.has\(item\.id\)\)/, "revoked cached cards must not be resurrected");
  assert.match(feed, /id:\s*"asc"/);
});

test("ranked catalog reuse is keyed only on public explicit filters and has finite TTL", () => {
  const listing = readFileSync("src/server/discovery/kudaListingPage.ts", "utf8");
  assert.match(listing, /unstable_cache\(/);
  assert.match(listing, /revalidate:\s*60/);
  assert.match(listing, /JSON\.stringify\(\{ format, eventFilters \}\)/);
  assert.match(listing, /getKudaDiscoveryFeed\(input\.cityId, input\.citySlug, null,/);
  const cacheKeys = listing.slice(listing.indexOf('"kuda-ranked-candidates-v1"'), listing.indexOf("{ revalidate: 60 }"));
  assert.doesNotMatch(cacheKeys, /input\.userId|selectedPersonaIds|familyId/);
});

test("full-card and media hydration is bounded to current page IDs", () => {
  const listing = readFileSync("src/server/discovery/kudaListingPage.ts", "utf8");
  const feed = readFileSync("src/server/discovery/kudaDiscoveryFeed.ts", "utf8");
  assert.match(listing, /rankOnly:\s*true/);
  assert.match(listing, /onlyIds:\s*visibleIds/);
  assert.match(feed, /options\?\.rankOnly \? 0 : GALLERY_FOR_COVER/);
  assert.match(listing, /page\.items\.filter\(item => byId\.has\(item\.id\)\)/, "revoked cached cards must not be resurrected");
  assert.match(feed, /id: \{ in: options\.onlyIds \}/);
  assert.match(listing, /page\.items\.map\(\(item\) => item\.id\)/);
});
