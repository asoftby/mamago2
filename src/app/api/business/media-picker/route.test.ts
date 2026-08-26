/**
 * Static wiring checks for /api/business/media-picker/route.ts — same
 * technique as adminRankingRouteWiring.test.ts (getCurrentUser()'s cookies()
 * call needs a real Next.js request scope, so it can't be invoked directly
 * here). The cursor-pagination behavior itself is covered against a real DB
 * in src/lib/media/mediaPickerQuery.test.ts, which this route delegates to.
 *
 * Запуск: npx tsx src/app/api/business/media-picker/route.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/business/media-picker/route.ts", "utf8");

assert.match(source, /await getCurrentUser\(\)/, "must resolve the actor via getCurrentUser()");
assert.match(source, /canCreateBusinessContent\(user\.role\)/, "must gate on business-content role before querying");
assert.match(
  source,
  /queryMediaPickerPage\(\{ uploadedById: user\.id, cursor, limit \}\)/,
  "must always scope to the requesting user's own uploads — never another user's media",
);
assert.doesNotMatch(source, /take:\s*60/, "the old hard 60-item cap must be gone");
assert.doesNotMatch(source, /Math\.min\(60/, "the old hand-rolled 60-item clamp must be gone");
assert.match(source, /nextCursor: page\.nextCursor/);
assert.match(source, /hasMore: page\.hasMore/);

console.log("business media-picker route wiring test: OK");
