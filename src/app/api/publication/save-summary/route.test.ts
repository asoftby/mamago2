import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/publication/save-summary/route.ts", "utf8");
const bar = readFileSync("src/components/shared/PublicationSaveShare.tsx", "utf8");
const consent = readFileSync("src/app/api/me/public-save-avatar-consent/route.ts", "utf8");

for (const table of ["Idea", "OfferIdea", "PlaceIdea"]) {
  assert.ok(route.includes('FROM "' + table + '"'), "Missing save source " + table);
}
assert.equal((route.match(/UNION ALL/g) ?? []).length, 3, "All save sources must be included");
assert.match(route, /GROUP BY "userId"/, "Unique-user deduplication is mandatory");
assert.match(route, /"cancelledAt" IS NULL/);
assert.match(route, /"status" = 'CONFIRMED'/);
assert.match(route, /COUNT\(\*\)::int/);
assert.match(route, /"PublicSaveAvatarConsent"/);
assert.match(route, /"revokedAt" IS NULL/);
assert.match(route, /ORDER BY unique_savers.saved_at DESC/);
assert.match(route, /LIMIT 5/);
assert.doesNotMatch(route, /displayName|json_build_object\([\s\S]*?'id'/, "Do not expose names or user IDs");
assert.match(consent, /getCurrentUser/);
assert.match(consent, /textVersion/);
assert.match(consent, /revokedAt/);
assert.match(bar, /publication-save-changed/);
assert.match(bar, /total >= 3/);
assert.doesNotMatch(bar, /onOpenSavers|href=.*saver/, "No clickable avatar or saver list");
console.log("publication save summary privacy contract: OK");
