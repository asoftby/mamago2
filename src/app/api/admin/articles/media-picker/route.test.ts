/**
 * Static wiring checks for /api/admin/articles/media-picker/route.ts — the
 * behavioral cursor-pagination logic itself is covered against a real DB in
 * src/lib/media/mediaPickerQuery.test.ts (queryMediaPickerPage), which this
 * route delegates to entirely. getCurrentUser()'s cookies() call requires a
 * real Next.js request scope, so — same technique as
 * adminRankingRouteWiring.test.ts — this asserts the route's *wiring*: auth
 * gate runs first, authorUserId falls back to the caller's own id (no global
 * media leak), and cursor/limit are passed straight through.
 *
 * Запуск: npx tsx src/app/api/admin/articles/media-picker/route.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/admin/articles/media-picker/route.ts", "utf8");

assert.match(source, /await requireAdminOrModerator\(\)/, "must gate on ADMIN/MODERATOR before touching the DB");
assert.match(
  source,
  /if \(!user\)[\s\S]{0,40}return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/,
  "unauthenticated/wrong-role callers must get 401 before any query runs",
);
assert.match(
  source,
  /authorUserId = searchParams\.get\("authorUserId"\)\?\.trim\(\) \|\| user\.id/,
  "authorUserId must default to the requesting user's own id — never show the whole platform's media",
);
assert.match(source, /queryMediaPickerPage\(\{ uploadedById: authorUserId, cursor, limit \}\)/);
assert.doesNotMatch(source, /take:\s*60/, "the old hard 60-item cap must be gone");
assert.doesNotMatch(source, /maxLimit:\s*60/, "the old hard 60-item cap must be gone");

console.log("admin articles media-picker route wiring test: OK");
