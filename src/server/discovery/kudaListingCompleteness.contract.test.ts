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
  assert.match(listing, /withImageDimensions\(page\.items,/);
  assert.match(feed, /id:\s*"asc"/);
});
