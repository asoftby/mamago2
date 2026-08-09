/**
 * Critical-path test for business-facing publication-performance data
 * isolation. `getPerformanceMetricsByEntity()` is the function that feeds
 * the real "top publications" table on `/business/dashboard` — it must
 * never return metrics for entities the caller did not explicitly ask for,
 * since `getBusinessWorkspaceData()` only ever passes a business's own
 * event/offer ids into it. This test proves the isolation boundary at the
 * function itself: even with UserEvent rows present for a "foreign" entity,
 * only the explicitly requested entity ids come back.
 *
 * Self-generated temporary fixture (created and torn down within this
 * file), per project convention — exercises the real exported
 * getPerformanceMetricsByEntity() against the local dev DB.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/server/services/business/businessWorkspace.service.test.ts
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { getPerformanceMetricsByEntity } from "@/server/services/business/businessWorkspace.service";

const MY_EVENT_ID = "test-fixture-business-isolation-my-event";
const FOREIGN_EVENT_ID = "test-fixture-business-isolation-foreign-event";

async function cleanup() {
  await prisma.userEvent.deleteMany({
    where: { entityId: { in: [MY_EVENT_ID, FOREIGN_EVENT_ID] } },
  });
}

async function testForeignEntityMetricsAreNotReturned() {
  await cleanup();
  try {
    // "My" business's own event: 2 CTA clicks.
    await trackUserEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: MY_EVENT_ID,
    });
    await trackUserEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: MY_EVENT_ID,
    });
    // A different business's event, sitting in the same UserEvent table: 5 CTA clicks.
    await trackUserEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: FOREIGN_EVENT_ID,
    });
    await trackUserEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: FOREIGN_EVENT_ID,
    });
    await trackUserEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: FOREIGN_EVENT_ID,
    });
    await trackUserEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: FOREIGN_EVENT_ID,
    });
    await trackUserEvent({
      eventType: "CTA_CLICK",
      entityType: "EVENT",
      entityId: FOREIGN_EVENT_ID,
    });

    // Simulates getBusinessWorkspaceData() calling this with only "my" business's own ids.
    const metrics = await getPerformanceMetricsByEntity({
      events: [{ id: MY_EVENT_ID, title: "My event", updatedAt: new Date(), status: "PUBLISHED" }],
      offers: [],
    });

    assert.equal(metrics.get(`EVENT:${MY_EVENT_ID}`)?.ctaClicks, 2, "my own event's metrics must be present and correct");
    assert.equal(
      metrics.has(`EVENT:${FOREIGN_EVENT_ID}`),
      false,
      "a foreign business's event metrics must never appear when it was not in the requested id list — this is the isolation boundary",
    );
    assert.equal(metrics.size, 1, "no extra entities beyond what was explicitly requested");
  } finally {
    await cleanup();
  }
}

async function main() {
  await testForeignEntityMetricsAreNotReturned();
  console.log("business publication-performance isolation tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
