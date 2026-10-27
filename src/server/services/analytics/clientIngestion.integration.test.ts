/**
 * A2/A4 integration tests: bot-classified events are never written, accepted
 * client events persist `clientClass`, and the tracking-fix date is the first
 * classified DETAIL_OPEN.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/services/analytics/clientIngestion.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { trackUserEvent } from "./AnalyticsEventService";
import {
  __resetDetailOpenTrackingFixCacheForTests,
  detailOpenTrackingStatusForRange,
  getDetailOpenTrackingFixedAt,
} from "./detailOpenTrackingFix";
import { decideClientIngestion } from "@/lib/analytics/clientClass";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at an isolated test database");

const marker = `client-ingestion-${randomUUID().slice(0, 8)}`;
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function cleanup() {
  await prisma.userEvent.deleteMany({ where: { entityId: marker } });
}

async function simulateRoute(userAgent: string, sessionId: string | null) {
  // Same decision the route makes before calling trackUserEvent.
  const decision = decideClientIngestion({ userAgent, userId: null, sessionId });
  if (!decision.accept) return decision.reason;
  await trackUserEvent({
    eventType: "DETAIL_OPEN",
    entityType: "EVENT",
    entityId: marker,
    vertical: "CITY",
    sessionId,
    meta: { source: "detail" },
    clientClass: decision.clientClass,
  });
  return "accepted";
}

async function main() {
  await cleanup();
  try {
    // Googlebot never creates a UserEvent.
    assert.equal(await simulateRoute(GOOGLEBOT, "sid-bot"), "bot");
    // Even if a caller passes clientClass=bot straight into trackUserEvent.
    const direct = await trackUserEvent({ eventType: "DETAIL_OPEN", entityType: "EVENT", entityId: marker, clientClass: "bot" });
    assert.equal(direct.ok, true);
    assert.equal(await prisma.userEvent.count({ where: { entityId: marker } }), 0, "bots must not be written");

    // Anonymous without sessionId is not written.
    assert.equal(await simulateRoute(CHROME, null), "no_identity");
    assert.equal(await prisma.userEvent.count({ where: { entityId: marker } }), 0);

    // Browser open: exactly one DETAIL_OPEN with non-empty sessionId and clientClass=browser.
    __resetDetailOpenTrackingFixCacheForTests();
    assert.equal(await simulateRoute(CHROME, "sid-browser"), "accepted");
    const rows = await prisma.userEvent.findMany({ where: { entityId: marker } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.sessionId, "sid-browser");
    assert.equal(rows[0]!.clientClass, "browser");
    assert.deepEqual(rows[0]!.meta, { source: "detail" }, "meta.source=detail must be preserved");

    // A4: fix date = first classified DETAIL_OPEN; earlier range starts are flagged.
    const fixedAt = await getDetailOpenTrackingFixedAt(prisma);
    assert.ok(fixedAt, "fix date must be observed once a classified DETAIL_OPEN exists");
    assert.ok(fixedAt! <= rows[0]!.createdAt);
    assert.equal(detailOpenTrackingStatusForRange(fixedAt, new Date(fixedAt!.getTime() - 1)).rangeIncludesPreFixData, true);
    assert.equal(detailOpenTrackingStatusForRange(fixedAt, new Date(fixedAt!.getTime() + 1)).rangeIncludesPreFixData, false);
    assert.equal(detailOpenTrackingStatusForRange(null, new Date()).rangeIncludesPreFixData, true);

    console.log("clientIngestion.integration.test.ts: OK");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
