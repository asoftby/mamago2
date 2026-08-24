/**
 * Static wiring check for /api/admin/articles/[id]/media/route.ts — same
 * technique as ../../media-picker/route.test.ts: getCurrentUser()'s cookies()
 * call needs a real Next.js request scope, so this asserts the route's
 * *wiring* (auth gate first, delegates entirely to getArticleMediaItems,
 * 404s on a missing article) rather than exercising it end-to-end. The
 * aggregation logic itself is covered against a real DB in
 * articleMediaLibrary.test.ts, which this route delegates to entirely.
 *
 * Run: npx tsx src/app/api/admin/articles/[id]/media/route.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/admin/articles/[id]/media/route.ts", "utf8");

assert.match(source, /await requireAdminOrModerator\(\)/, "must gate on ADMIN/MODERATOR before touching the DB");
assert.match(
  source,
  /if \(!user\)[\s\S]{0,40}return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/,
  "unauthenticated/wrong-role callers must get 401 before any query runs",
);
assert.match(
  source,
  /getArticleMediaItems\(id\)/,
  "must delegate entirely to getArticleMediaItems — no duplicated aggregation logic in the route",
);
assert.match(
  source,
  /if \(items === null\)[\s\S]{0,60}status: 404/,
  "a missing article must 404 (distinct from an existing article with no referenced media, which is items: [])",
);
// The route itself takes no authorUserId/owner-scoping query param — unlike
// media-picker/route.ts, which deliberately does. The actual owner-agnostic
// guarantee (migrated/ADMIN-owned assets still surface) is proven behaviorally
// in articleMediaLibrary.test.ts against a real DB.
assert.doesNotMatch(
  source,
  /searchParams\.get\("authorUserId"\)/,
  "this route must not accept an ownership-scoping param — Article Media is not an ownership filter",
);

console.log("admin articles [id]/media route wiring test: OK");
