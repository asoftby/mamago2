/**
 * Critical-path tests for `POST /api/analytics/events` — the single public
 * ingestion endpoint behind the entire first-party `UserEvent` analytics
 * pipeline. Scope note: the route calls `getCurrentUser()` (→ Next.js
 * `cookies()`), which throws "outside a request scope" when the exported
 * handler is invoked directly via tsx rather than through a real Next.js
 * request — a known harness limitation, not a route bug (same acknowledged
 * pattern as `src/app/api/routes/ratings/[routeId]/route.test.ts`).
 * Validation runs *before* `getCurrentUser()` in this route, so the
 * rejection paths below are exercised for real; the write path (does a
 * valid event actually reach the DB with the right shape) is proven
 * end-to-end via `trackUserEvent()` directly in
 * `analyticsContentPerformance.service.test.ts`, and via DEV smoke where
 * this route runs inside a real request.
 *
 * Self-generated temporary fixture (created and torn down within this
 * file), per project convention — exercises the real exported POST()
 * against the local dev DB.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/app/api/analytics/events/route.test.ts
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { POST } from "./route";

const FIXTURE_ENTITY_ID = "test-fixture-analytics-events-ingestion";

function postEvent(body: unknown) {
  const req = new NextRequest("http://localhost:3000/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

async function cleanup() {
  await prisma.userEvent.deleteMany({ where: { entityId: FIXTURE_ENTITY_ID } });
}

async function testInvalidEventTypeRejected() {
  const res = await postEvent({
    eventType: "NOT_A_REAL_EVENT_TYPE",
    entityType: "PLACE",
    entityId: FIXTURE_ENTITY_ID,
  });
  assert.equal(res.status, 400, "an unknown eventType must be rejected, not silently written");
  const rows = await prisma.userEvent.findMany({ where: { entityId: FIXTURE_ENTITY_ID } });
  assert.equal(rows.length, 0, "rejected payload must not write a row");
}

async function testOversizedMetaRejected() {
  const res = await postEvent({
    eventType: "CTA_CLICK",
    entityType: "PLACE",
    entityId: FIXTURE_ENTITY_ID,
    meta: { blob: "x".repeat(5000) },
  });
  assert.equal(res.status, 400, "meta over the 4096-byte cap must be rejected");
  const rows = await prisma.userEvent.findMany({ where: { entityId: FIXTURE_ENTITY_ID } });
  assert.equal(rows.length, 0);
}

async function testMalformedJsonDoesNotCrash() {
  const req = new NextRequest("http://localhost:3000/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not valid json",
  });
  const res = await POST(req);
  assert.equal(res.status, 500, "malformed JSON must return a clean error response, not throw uncaught");
}

async function main() {
  await cleanup(); // guard against leftovers from a previously interrupted run
  await testInvalidEventTypeRejected();
  await testOversizedMetaRejected();
  await testMalformedJsonDoesNotCrash();
  console.log("/api/analytics/events ingestion tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
