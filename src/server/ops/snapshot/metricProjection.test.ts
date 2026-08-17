/**
 * MetricSample -> snapshot projection tests (§21 Step 5, Phase N/P).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/snapshot/metricProjection.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { projectOperationsKpis, projectOperationsQueues } from "./metricProjection";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  try {
    await prisma.metricSample.deleteMany({});

    // Missing sample projects to null, never 0.
    {
      const kpis = await projectOperationsKpis(prisma);
      assert.equal(kpis["audience.dau"], null, "an unwritten metric must project to null, not 0");
      const queues = await projectOperationsQueues(prisma);
      assert.equal(queues.import.reviewSize, null);
      assert.equal(queues.moderation.place.size, null);
    }

    // Latest sample wins; an older sample for the same (metric, dimKey) is ignored.
    {
      const older = new Date(Date.now() - 60_000);
      const newer = new Date();
      await prisma.metricSample.create({ data: { metric: "audience.dau", dimKey: "", value: 10, collectedAt: older } });
      await prisma.metricSample.create({ data: { metric: "audience.dau", dimKey: "", value: 42, collectedAt: newer } });

      const kpis = await projectOperationsKpis(prisma);
      assert.equal(kpis["audience.dau"], 42, "must project the most recently collected value");
    }

    // A genuinely observed zero must project as 0, not be confused with "missing".
    {
      await prisma.metricSample.create({ data: { metric: "import.failed_sources", dimKey: "", value: 0 } });
      const queues = await projectOperationsQueues(prisma);
      assert.equal(queues.import.failedSources, 0);
    }

    // Queue dimensions are projected independently per dimKey.
    {
      await prisma.metricSample.create({ data: { metric: "queue.moderation.size", dimKey: "place", value: 3 } });
      await prisma.metricSample.create({ data: { metric: "queue.moderation.size", dimKey: "offer", value: 1 } });
      await prisma.metricSample.create({ data: { metric: "queue.moderation.oldest_age_sec", dimKey: "place", value: 7200 } });

      const queues = await projectOperationsQueues(prisma);
      assert.equal(queues.moderation.place.size, 3);
      assert.equal(queues.moderation.offer.size, 1);
      assert.equal(queues.moderation.place.oldestAgeSec, 7200);
      assert.equal(queues.moderation.place_revision.size, null, "an unwritten dimKey must remain null, not leak another dim's value");
      assert.equal(queues.moderation.event.size, null);
    }

    // The DB metric series (db.latency_ms / db.connection_capacity_pct) is
    // sourced from whatever is already in MetricSample — Step 5 does not
    // write it and must not duplicate it; the projection is a pure read.
    {
      await prisma.metricSample.create({ data: { metric: "db.latency_ms", dimKey: "", value: 12.5 } });
      const kpis = await projectOperationsKpis(prisma);
      assert.equal(kpis["db.latency_ms"], 12.5);

      const countBefore = await prisma.metricSample.count({ where: { metric: "db.latency_ms" } });
      await projectOperationsKpis(prisma);
      const countAfter = await prisma.metricSample.count({ where: { metric: "db.latency_ms" } });
      assert.equal(countAfter, countBefore, "projection is read-only and must never write a MetricSample row");
    }

    console.log("metricProjection.test.ts: OK");
  } finally {
    await prisma.metricSample.deleteMany({});
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
