/**
 * Static wiring guard for discovery-hub reference caching. The final Event feed
 * stays uncached; only City reference expansion is allowed in this slice.
 *
 * Run: pnpm exec tsx src/server/discovery/discoveryHubExpandCacheWiring.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/server/discovery/discoveryHubExpand.ts", "utf8");
const feedSource = readFileSync("src/server/discovery/kudaDiscoveryFeed.ts", "utf8");

assert.match(source, /unstable_cache/);
assert.match(source, /DISCOVERY_HUB_CITY_IDS_REVALIDATE_SECONDS = 60 \* 60/);
assert.match(
  source,
  /if \(!extras\?\.length\) \{[\s\S]*return fallbackHubCityIds\(hubCityId\);[\s\S]*\}/,
  "non-hub cities must keep the zero-DB fast path",
);
assert.match(
  source,
  /\["discovery-hub-city-ids", hubCitySlug, hubCityId, \.\.\.extras\]/,
  "cache identity must include hub slug/id and configured expansion slugs",
);
assert.match(
  source,
  /where: \{ slug: \{ in: slugs \}, isLegacyNonCity: false \}/,
  "cached lookup must keep the canonical City visibility filter",
);
assert.match(
  feedSource,
  /resolveKudaDiscoveryCityIds\(citySlug, cityId\)/,
  "Event discovery must continue consuming the shared resolver",
);
assert.doesNotMatch(
  source,
  /currentUserId|getWeatherRankingBoost|getEventEngagementScores|boosts/,
  "reference cache must stay isolated from personalized/time-sensitive ranking",
);
assert.doesNotMatch(
  feedSource,
  /unstable_cache/,
  "final Event discovery feed must remain uncached in this phase",
);

console.log("discovery hub city cache wiring tests: OK");
