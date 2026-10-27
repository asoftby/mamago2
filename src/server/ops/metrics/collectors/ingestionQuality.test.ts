/**
 * ingestion_quality collector tests (A3).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/ingestionQuality.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { collectIngestionQuality } from "./ingestionQuality";
import { INGESTION_DELTA_METRICS } from "@/server/services/analytics/ingestionCounters";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at an isolated test database");

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  // Far-future "now" so real rows never fall in the window.
  const now = new Date("2031-03-10T12:00:00.000Z");
  const metrics = Object.values(INGESTION_DELTA_METRICS);
  const cleanup = () => prisma.metricSample.deleteMany({ where: { metric: { in: metrics } } });
  await cleanup();
  try {
    // Empty window: shares undefined -> no samples (never a fabricated 0).
    const empty = await collectIngestionQuality({ prisma, now });
    assert.equal(empty.find((s) => s.metric.startsWith("telemetry.bot_rejected")), undefined);

    const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600_000);
    await prisma.metricSample.createMany({
      data: [
        { metric: INGESTION_DELTA_METRICS.accepted, value: 60, collectedAt: at(1) },
        { metric: INGESTION_DELTA_METRICS.bot, value: 30, collectedAt: at(2) },
        { metric: INGESTION_DELTA_METRICS.no_identity, value: 10, collectedAt: at(3) },
        // Outside 24h, inside 7d.
        { metric: INGESTION_DELTA_METRICS.accepted, value: 100, collectedAt: at(48) },
        { metric: INGESTION_DELTA_METRICS.bot, value: 100, collectedAt: at(72) },
        // Outside 7d.
        { metric: INGESTION_DELTA_METRICS.bot, value: 1000, collectedAt: at(24 * 8) },
      ],
    });
    const samples = await collectIngestionQuality({ prisma, now });
    const get = (m: string) => samples.find((s) => s.metric === m)?.value;
    assert.equal(get("telemetry.bot_rejected_share_24h"), 0.3);
    assert.equal(get("telemetry.no_identity_rejected_share_24h"), 0.1);
    assert.equal(get("telemetry.bot_rejected_share_7d"), 130 / 300);
    console.log("ingestionQuality.test.ts: OK");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
