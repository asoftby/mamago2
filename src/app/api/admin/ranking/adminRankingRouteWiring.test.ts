/**
 * Static wiring checks for the /api/admin/ranking and /api/admin/search/ranking
 * route.ts wrappers — the parts that can't be exercised directly because
 * getCurrentUser()'s cookies() call requires a real Next.js request scope (see
 * adminRankingHandlers.test.ts / adminSearchRankingHandlers.test.ts for the
 * behavioral coverage of the testable core these wrappers delegate to).
 *
 * Confirms: auth is resolved server-side before any handler runs, the actor
 * passed to the handlers always comes from that server-side resolution (never
 * from the request body), and cache invalidation only fires on the success path.
 * Same technique as src/app/admin/ranking/stories-intents/storiesRouteIntegration.test.ts.
 *
 * Запуск: npx tsx src/app/api/admin/ranking/adminRankingRouteWiring.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rankingRoute = readFileSync("src/app/api/admin/ranking/route.ts", "utf8");
const searchRankingRoute = readFileSync("src/app/api/admin/search/ranking/route.ts", "utf8");

// --- /api/admin/ranking ---
assert.match(rankingRoute, /import\s*{\s*handleRankingGet,\s*handleRankingPost\s*}\s*from\s*"@\/server\/services\/ranking\/adminRankingHandlers"/);
assert.match(rankingRoute, /await getCurrentUser\(\)/, "requireAdmin must resolve the actor via getCurrentUser()");
assert.match(rankingRoute, /handleRankingGet\(user\)/, "GET must pass the server-resolved user, not a body value");
assert.match(rankingRoute, /handleRankingPost\(user, type, data\)/, "POST must pass the server-resolved user first");
assert.doesNotMatch(rankingRoute, /actorId/, "route.ts must never read an actor identity out of the request body");
assert.match(rankingRoute, /if \(result\.invalidateCache\)\s*{\s*revalidateTag/, "cache invalidation must be gated on the handler's success flag");

// --- /api/admin/search/ranking ---
assert.match(searchRankingRoute, /import\s*{\s*\n?\s*handleSearchRankingGet,\s*\n?\s*handleSearchRankingMutation,?\s*\n?\s*}\s*from\s*"@\/server\/services\/search\/adminSearchRankingHandlers"/);
assert.match(searchRankingRoute, /await getCurrentUser\(\)/g);
assert.match(searchRankingRoute, /handleSearchRankingGet\(user\)/);
assert.match(searchRankingRoute, /handleSearchRankingMutation\(user\)/g);
assert.doesNotMatch(searchRankingRoute, /actorId/, "route.ts must never read an actor identity out of the request body");
// PATCH/POST must not construct a settings update from the request body anymore.
assert.doesNotMatch(searchRankingRoute, /prisma\.searchRankingSettings\.(update|create)\(/);

console.log("admin ranking route wiring tests: OK");
