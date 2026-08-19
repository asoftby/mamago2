/**
 * Backend Operations read contract tests (§21 Step 2, Phase R).
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/read/getOperationsView.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import {
  getOperationsViewWithClient,
  STALE_THRESHOLD_SEC,
  OPERATIONS_DATA_STALE_FINGERPRINT,
} from "./getOperationsView";
import { emptySnapshotPayload } from "../snapshot/payload";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const createdUserIds: string[] = [];

async function makeUser(prisma: PrismaClient): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `ops-read-test-${randomUUID()}@example.test` },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  try {
    await prisma.operationsSnapshot.deleteMany({ where: { id: "current" } });

    // 1. No snapshot -> stale = true.
    {
      const userId = await makeUser(prisma);
      const view = await getOperationsViewWithClient(prisma, userId);
      assert.equal(view.stale, true);
      assert.equal(view.generatedAt, null);
      // 3. Stale response contains synthetic CRITICAL.
      assert.equal(view.syntheticSignals.length, 1);
      assert.equal(view.syntheticSignals[0].type, "OPERATIONS_DATA_STALE");
      assert.equal(view.syntheticSignals[0].severity, "CRITICAL");
      assert.equal(view.syntheticSignals[0].fingerprint, OPERATIONS_DATA_STALE_FINGERPRINT);
      // 4. Stale response sets all four nodes to NO_DATA.
      assert.equal(view.nodes.length, 4);
      assert.ok(view.nodes.every((n) => n.state === "NO_DATA"));
    }

    // 2. Snapshot older than 300 sec -> stale = true.
    {
      const userId = await makeUser(prisma);
      const staleGeneratedAt = new Date(Date.now() - (STALE_THRESHOLD_SEC + 30) * 1000);
      await prisma.operationsSnapshot.upsert({
        where: { id: "current" },
        create: {
          id: "current",
          generatedAt: staleGeneratedAt,
          startedAt: staleGeneratedAt,
          completedAt: staleGeneratedAt,
          payload: emptySnapshotPayload() as object,
        },
        update: {
          generatedAt: staleGeneratedAt,
          startedAt: staleGeneratedAt,
          completedAt: staleGeneratedAt,
        },
      });

      const view = await getOperationsViewWithClient(prisma, userId);
      assert.equal(view.stale, true);
      assert.equal(view.syntheticSignals.length, 1);
      assert.ok(view.nodes.every((n) => n.state === "NO_DATA"));
    }

    // 5 & 6. Fresh snapshot -> stale = false; nodes are materialized
    // verbatim from payload (not recomputed) — prove it by storing a
    // non-NO_DATA state and confirming it comes back unchanged.
    {
      const userId = await makeUser(prisma);
      const freshPayload = {
        ...emptySnapshotPayload(),
        nodes: [
          { key: "PROD", state: "OK" },
          { key: "DB", state: "WARNING" },
          { key: "Operations", state: "NO_DATA" },
          { key: "Indexability", state: "CRITICAL" },
        ],
      };
      const now = new Date();
      await prisma.operationsSnapshot.upsert({
        where: { id: "current" },
        create: {
          id: "current",
          generatedAt: now,
          startedAt: now,
          completedAt: now,
          payload: freshPayload as object,
        },
        update: { generatedAt: now, startedAt: now, completedAt: now, payload: freshPayload as object },
      });

      const view = await getOperationsViewWithClient(prisma, userId);
      assert.equal(view.stale, false);
      assert.equal(view.syntheticSignals.length, 0);
      assert.deepEqual(view.nodes, freshPayload.nodes, "nodes must be read verbatim from the stored payload");
    }

    // 7. No MetricSample aggregation occurs in the read path: insert a
    // distinctive sample and confirm it never surfaces in kpis/queues.
    {
      await prisma.metricSample.create({
        data: { metric: "ops-read-test.canary", value: 99999 },
      });
      const userId = await makeUser(prisma);
      const view = await getOperationsViewWithClient(prisma, userId);
      assert.deepEqual(view.kpis, {}, "kpis must stay empty — no MetricSample scan");
      assert.deepEqual(view.queues, {}, "queues must stay empty — no MetricSample scan");
    }

    // 7b. signalReleases is always present and empty when there are no
    // OPEN signals with an openedAt to correlate.
    {
      const userId = await makeUser(prisma);
      const view = await getOperationsViewWithClient(prisma, userId);
      assert.deepEqual(view.signalReleases, {}, "no visible signals -> no correlation queries, empty map");
    }

    // 8. lastViewedAt is read before being updated.
    {
      const userId = await makeUser(prisma);
      const first = await getOperationsViewWithClient(prisma, userId);
      assert.equal(first.lastViewedAt, null, "no prior view state -> null on first call");

      const between = await prisma.operationsViewState.findUniqueOrThrow({ where: { userId } });

      const second = await getOperationsViewWithClient(prisma, userId);
      assert.equal(
        second.lastViewedAt?.getTime(),
        between.lastViewedAt.getTime(),
        "second call must report the PREVIOUS lastViewedAt (set by the first call), not a value from its own update",
      );
    }

    console.log("getOperationsView.test.ts: OK");
  } finally {
    await prisma.metricSample.deleteMany({ where: { metric: "ops-read-test.canary" } });
    await prisma.operationsSnapshot.deleteMany({ where: { id: "current" } });
    await prisma.operationsViewState.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
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
