/**
 * getTrafficViewModel() integration tests (§ Traffic telemetry completion).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/admin/getTrafficViewModel.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type UserEventType } from "@prisma/client";
import { getTrafficViewModel } from "./getTrafficViewModel";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const marker = `traffic-test-${randomUUID().slice(0, 8)}`;
  const createdEventIds: string[] = [];

  async function makeEvent(sessionId: string, createdAt: Date, eventType: UserEventType = "PAGE_VIEW") {
    const event = await prisma.userEvent.create({
      data: { eventType, sessionId, createdAt },
    });
    createdEventIds.push(event.id);
  }

  try {
    // A fixed, controlled "now": 12:00 Europe/Minsk (UTC+3) = 09:00 UTC.
    const now = new Date("2026-06-15T09:00:00.000Z");
    const todayStart = new Date("2026-06-14T21:00:00.000Z"); // 00:00 Minsk
    const yesterdayStart = new Date("2026-06-13T21:00:00.000Z");

    // 3 distinct visitor sessions today, one with 2 PAGE_VIEWs (page views != visitors).
    await makeEvent(`${marker}-s1`, new Date(todayStart.getTime() + 60_000));
    await makeEvent(`${marker}-s1`, new Date(todayStart.getTime() + 120_000)); // 2nd page view, same visitor
    await makeEvent(`${marker}-s2`, new Date(todayStart.getTime() + 30 * 60_000));
    await makeEvent(`${marker}-s3`, new Date(now.getTime() - 60_000)); // just before "now"

    // Background-only telemetry (no PAGE_VIEW) must NOT count as a visitor
    // or a page view — the frozen product definition is PAGE_VIEW-only.
    await makeEvent(`${marker}-background-only`, new Date(todayStart.getTime() + 90_000), "CARD_VIEW");

    // Outside today's elapsed window (after "now") -> must not count.
    await makeEvent(`${marker}-future`, new Date(now.getTime() + 60_000));

    // 2 distinct PAGE_VIEW sessions yesterday, within the same elapsed window.
    await makeEvent(`${marker}-y1`, new Date(yesterdayStart.getTime() + 60_000));
    await makeEvent(`${marker}-y2`, new Date(yesterdayStart.getTime() + 30 * 60_000));

    // Yesterday but AFTER the elapsed cutoff (i.e. yesterday afternoon) -> must not count.
    await makeEvent(`${marker}-y-late`, new Date(yesterdayStart.getTime() + 20 * 60 * 60_000));

    const model = await getTrafficViewModel(prisma, now);

    assert.equal(model.uniqueVisitorsToday, 3, "3 distinct PAGE_VIEW sessions today, CARD_VIEW-only session excluded");
    assert.equal(model.uniqueVisitorsYesterday, 2, "2 distinct PAGE_VIEW sessions in yesterday's matching elapsed window");
    assert.equal(model.visitorsDeltaPercent, 50, "(3-2)/2 = +50%");

    assert.equal(model.pageViewsToday, 4, "4 total PAGE_VIEW rows today (s1 has 2), CARD_VIEW row excluded");
    assert.equal(model.pageViewsYesterday, 2);
    assert.equal(model.pageViewsDeltaPercent, 100, "(4-2)/2 = +100%");

    assert.equal(model.pageViewsPerVisitor, 1.3, "round(4/3, 1 decimal) = 1.3");

    // Region distribution remains a documented GAP — blocked on trusted-IP
    // host verification + GeoIP source, never fabricated.
    assert.equal(model.regions, null);

    // Zero-denominator: no PAGE_VIEW visitors at all yesterday -> deltas must
    // be null, never a fabricated infinite/undefined percentage. Uses a
    // distinct date so it doesn't overlap the fixtures created above.
    {
      const isolatedNow = new Date("2026-01-05T09:00:00.000Z");
      const isolatedTodayStart = new Date("2026-01-04T21:00:00.000Z");
      const marker3 = `traffic-test-iso-${randomUUID().slice(0, 8)}`;
      await makeEvent(`${marker3}-s1`, new Date(isolatedTodayStart.getTime() + 60_000));
      const isolatedModel = await getTrafficViewModel(prisma, isolatedNow);
      assert.equal(isolatedModel.uniqueVisitorsToday, 1);
      assert.equal(isolatedModel.uniqueVisitorsYesterday, 0, "no fixtures exist for this isolated date -> truthfully 0");
      assert.equal(isolatedModel.visitorsDeltaPercent, null, "zero-denominator delta must be null, not a fabricated percentage");
      assert.equal(isolatedModel.pageViewsYesterday, 0);
      assert.equal(isolatedModel.pageViewsDeltaPercent, null);
      assert.equal(isolatedModel.pageViewsPerVisitor, 1, "1 page view / 1 visitor = 1.0");
    }

    // True zero visitors today -> pageViewsPerVisitor must be null ("—" in UI), never 0/NaN/Infinity.
    {
      const emptyNow = new Date("2025-01-05T09:00:00.000Z");
      const emptyModel = await getTrafficViewModel(prisma, emptyNow);
      assert.equal(emptyModel.uniqueVisitorsToday, 0);
      assert.equal(emptyModel.pageViewsToday, 0);
      assert.equal(emptyModel.pageViewsPerVisitor, null, "0 visitors -> null, never a fabricated 0/NaN/Infinity");
    }

    console.log("getTrafficViewModel.test.ts: OK");
  } finally {
    await prisma.userEvent.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
