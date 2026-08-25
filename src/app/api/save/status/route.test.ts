/**
 * Static wiring checks for /api/save/status/route.ts — getCurrentUser()'s
 * cookies() call needs a real Next.js request scope, so the handler can't
 * be invoked directly here (same technique as
 * business/media-picker/route.test.ts). Guards against regressing to a 401
 * for guests, defense-in-depth alongside the client-side guard in
 * saveStatusFetchGuard.ts.
 *
 * Run: npx tsx src/app/api/save/status/route.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/save/status/route.ts", "utf8");

// Guest: must return a 200 read-only empty status, never a 401.
const guestBranch = source.slice(source.indexOf("if (!user) {"), source.indexOf("const { searchParams }"));
assert.match(
  guestBranch,
  /NextResponse\.json\(\{/,
  "guest branch must return NextResponse.json(...) with no explicit status",
);
assert.doesNotMatch(
  guestBranch,
  /status:\s*401/,
  "guest must not get a 401 — this is a read-only status endpoint for public UI",
);
assert.match(guestBranch, /isSaved:\s*false/);
assert.match(guestBranch, /isIdea:\s*false/);
assert.match(guestBranch, /inPlan:\s*false/);
assert.match(guestBranch, /planDate:\s*null/);
assert.match(guestBranch, /planStartsAt:\s*null/);
assert.match(guestBranch, /planItemId:\s*null/);

// Authenticated path must still resolve account-specific state per entity type.
assert.match(source, /hasArticleIdea\(user\.id, articleId\)/);
assert.match(source, /hasPlaceIdea\(user\.id, placeId\)/);
assert.match(source, /hasOfferIdea\(user\.id, offerId\)/);
assert.match(source, /hasIdea\(user\.id, activityId!\)/);
assert.match(source, /resolveIdeaPlanState\(/);

// Mutation endpoints are a different, untouched contract — this route stays read-only.
assert.doesNotMatch(source, /export async function (POST|DELETE|PUT|PATCH)/);

console.log("save/status route wiring test: OK");
