/**
 * PAGE_VIEW ingestion critical-path tests, via `trackUserEvent()` directly
 * (same convention as analyticsContentPerformance.service.test.ts — the API
 * route can't be black-box tested end-to-end for a successful write outside
 * a real Next.js request scope, see events/route.test.ts's header comment).
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/services/analytics/pageViewIngestion.test.ts
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";

const FIXTURE_SESSION_ID = "test-fixture-page-view-ingestion-session";

async function cleanup() {
  await prisma.userEvent.deleteMany({ where: { sessionId: FIXTURE_SESSION_ID } });
}

async function testPageViewAcceptedAndPersisted() {
  await cleanup();
  try {
    const result = await trackUserEvent({
      sessionId: FIXTURE_SESSION_ID,
      eventType: "PAGE_VIEW",
      meta: { path: "/minsk/events/some-slug" },
    });
    assert.equal(result.ok, true, "PAGE_VIEW must be accepted, no entityType/entityId required");

    const rows = await prisma.userEvent.findMany({ where: { sessionId: FIXTURE_SESSION_ID } });
    assert.equal(rows.length, 1, "exactly one PAGE_VIEW row must be written");
    assert.equal(rows[0].eventType, "PAGE_VIEW");
    assert.equal(rows[0].sessionId, FIXTURE_SESSION_ID, "client sessionId must be preserved verbatim");
    assert.equal(rows[0].userId, null, "anonymous PAGE_VIEW must not fabricate a userId");
    assert.deepEqual(rows[0].meta, { path: "/minsk/events/some-slug" });
  } finally {
    await cleanup();
  }
}

async function testAuthenticatedUserIdAttached() {
  await cleanup();
  try {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) {
      console.log("testAuthenticatedUserIdAttached: skipped (no User row in this DB)");
      return;
    }
    await trackUserEvent({
      userId: user.id,
      sessionId: FIXTURE_SESSION_ID,
      eventType: "PAGE_VIEW",
      meta: { path: "/minsk" },
    });
    const row = await prisma.userEvent.findFirst({ where: { sessionId: FIXTURE_SESSION_ID } });
    assert.equal(row?.userId, user.id, "authenticated userId must be attached server-side");
  } finally {
    await cleanup();
  }
}

async function main() {
  await testPageViewAcceptedAndPersisted();
  await testAuthenticatedUserIdAttached();
  console.log("pageViewIngestion.test.ts: OK");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
