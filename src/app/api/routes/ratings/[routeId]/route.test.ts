/**
 * Regression test for ROUTE_RATINGS_PARAMS_NOT_AWAITED.
 *
 * `params` on a Next.js route handler is a Promise; the handler used to
 * destructure it synchronously (`const { routeId } = params`), which made
 * `routeId` resolve to the Promise object itself rather than the actual
 * value, tripping the `!routeId` guard and returning HTTP 400 on every
 * request. Exercises the real exported `GET` against the local dev DB
 * (read-only groupBy/findUnique — no writes) to prove the fix end-to-end.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/app/api/routes/ratings/[routeId]/route.test.ts
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "./route";

async function testAwaitedParamsNoLongerReturns400() {
  // Calling the handler directly (outside a real Next.js request) makes
  // getCurrentUser()'s cookies() throw "outside a request scope" — that's a
  // harness artifact, not a route bug; the route's own try/catch turns it
  // into a 200 fallback. What this proves is the thing that regressed: the
  // `!routeId` guard, which runs BEFORE getCurrentUser(), no longer fires —
  // i.e. `routeId` was correctly awaited rather than resolving to the
  // Promise object itself (which was falsy and returned 400 for every
  // request).
  const req = new NextRequest("http://localhost:3000/api/routes/ratings/nonexistent-route-id");
  const res = await GET(req, { params: Promise.resolve({ routeId: "nonexistent-route-id" }) });
  assert.equal(res.status, 200, `expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(typeof body.like, "number");
  assert.equal(typeof body.neutral, "number");
  assert.equal(typeof body.dislike, "number");
  assert.ok("myVote" in body);
}

async function main() {
  await testAwaitedParamsNoLongerReturns400();
  console.log("route ratings handler tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
