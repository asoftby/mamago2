/** Static guard: cache only the City/oblast reference expansion, not final Event results. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/server/discovery/discoveryHubExpand.ts", "utf8");
const feedSource = readFileSync("src/server/discovery/kudaDiscoveryFeed.ts", "utf8");

assert.match(source, /unstable_cache/);
assert.match(source, /DISCOVERY_HUB_CITY_IDS_REVALIDATE_SECONDS = 60 \* 60/);
assert.match(source, /regionId/);
assert.match(source, /minskaya-oblast/, "Minsk must include Minsk oblast even without city.regionId");
assert.match(source, /countryId: city.countryId/, "expansion must stay within the country");
assert.match(source, /isLegacyNonCity: false/, "legacy pseudo-cities must not enter the feed");
assert.match(source, /isActive: true/, "inactive cities must not enter the feed");
assert.match(source, /\["discovery-oblast-city-ids-v2", hubCitySlug, hubCityId\]/);
assert.match(feedSource, /resolveKudaDiscoveryCityIds\(citySlug, cityId\)/);
assert.doesNotMatch(source, /currentUserId|getWeatherRankingBoost|getEventEngagementScores|boosts/);
assert.doesNotMatch(feedSource, /unstable_cache/);

console.log("discovery oblast city cache wiring tests: OK");
