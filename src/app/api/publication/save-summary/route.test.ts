/**
 * Guard the public save-summary contract until the database-backed integration
 * suite is available in CI. Run: pnpm exec tsx src/app/api/publication/save-summary/route.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/publication/save-summary/route.ts", "utf8");
const bar = readFileSync("src/components/shared/PublicationSaveShare.tsx", "utf8");

for (const table of ["Idea", "OfferIdea", "PlaceIdea"]) {
  assert.ok(route.includes(`FROM "${table}"`), `Counts must include ${table}`);
}
assert.equal((route.match(/\bUNION\b/g) ?? []).length, 3, "Each type must dedupe plan and idea saves");
assert.match(route, /"cancelledAt" IS NULL/);
assert.match(route, /"status" = 'CONFIRMED'/);
assert.match(route, /COUNT\(\*\)::int/);
assert.match(route, /visibleSavers:\s*\[\]/, "Do not expose avatar identities without opt-in");
assert.doesNotMatch(route, /avatarUrl|displayName|\.user\.findMany/, "Public summary must not identify private savers");
assert.match(bar, /publication-save-changed/, "Counts must refresh after a successful mutation");

console.log("publication save summary static privacy contract: OK");
