/**
 * import metric collector tests (§21 Step 5, Phase P).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/importMetrics.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { collectImportMetrics } from "./importMetrics";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const createdSourceIds: string[] = [];
const createdRecordIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeSource(name: string, isActive = true): Promise<string> {
    const source = await prisma.importSource.create({
      data: {
        name,
        slug: `test-import-metric-${name}-${Math.random().toString(36).slice(2)}`,
        type: "WEBSITE",
        isActive,
      },
    });
    createdSourceIds.push(source.id);
    return source.id;
  }

  async function makeRun(sourceId: string, status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED", finishedAt: Date | null): Promise<void> {
    await prisma.importRun.create({
      data: { sourceId, status, finishedAt: finishedAt ?? undefined, createdAt: finishedAt ?? new Date() },
    });
  }

  async function makeReviewRecord(sourceId: string, reviewStatus: "PENDING" | "APPROVED" | "REJECTED"): Promise<void> {
    const record = await prisma.importedRecord.create({ data: { sourceId, reviewStatus } });
    createdRecordIds.push(record.id);
  }

  async function cleanup() {
    await prisma.importedRecord.deleteMany({ where: { id: { in: createdRecordIds } } });
    await prisma.importRun.deleteMany({ where: { sourceId: { in: createdSourceIds } } });
    await prisma.importSource.deleteMany({ where: { id: { in: createdSourceIds } } });
  }

  try {
    const now = new Date();

    async function deltas() {
      const result = await collectImportMetrics({ prisma, now });
      return {
        reviewSize: result.find((s) => s.metric === "queue.import.review_size")!.value,
        failedSources: result.find((s) => s.metric === "import.failed_sources")!.value,
      };
    }

    // review_size: PENDING counted, APPROVED not.
    {
      const before = await deltas();
      const sourceId = await makeSource("review-pending");
      await makeReviewRecord(sourceId, "PENDING");
      await makeReviewRecord(sourceId, "APPROVED");
      const after = await deltas();
      assert.equal(after.reviewSize, before.reviewSize + 1, "only PENDING review records should be counted");
    }

    // failed_sources: active FAILED source counted.
    {
      const before = await deltas();
      const sourceId = await makeSource("active-failed");
      await makeRun(sourceId, "FAILED", new Date());
      const after = await deltas();
      assert.equal(after.failedSources, before.failedSources + 1);
    }

    // inactive source excluded even if latest run FAILED.
    {
      const before = await deltas();
      const sourceId = await makeSource("inactive-failed", false);
      await makeRun(sourceId, "FAILED", new Date());
      const after = await deltas();
      assert.equal(after.failedSources, before.failedSources, "inactive source must not count");
    }

    // FAILED then RUNNING (non-terminal) -> failure remains.
    {
      const before = await deltas();
      const sourceId = await makeSource("failed-then-running");
      await makeRun(sourceId, "FAILED", new Date(now.getTime() - 60_000));
      await makeRun(sourceId, "RUNNING", null);
      const after = await deltas();
      assert.equal(after.failedSources, before.failedSources + 1, "RUNNING must not clear a prior FAILED outcome");
    }

    // FAILED then PENDING (non-terminal) -> failure remains.
    {
      const before = await deltas();
      const sourceId = await makeSource("failed-then-pending");
      await makeRun(sourceId, "FAILED", new Date(now.getTime() - 60_000));
      await makeRun(sourceId, "PENDING", null);
      const after = await deltas();
      assert.equal(after.failedSources, before.failedSources + 1, "PENDING must not clear a prior FAILED outcome");
    }

    // FAILED then later COMPLETED -> recovered, not counted.
    {
      const before = await deltas();
      const sourceId = await makeSource("failed-then-completed");
      await makeRun(sourceId, "FAILED", new Date(now.getTime() - 120_000));
      await makeRun(sourceId, "COMPLETED", new Date(now.getTime() - 60_000));
      const after = await deltas();
      assert.equal(after.failedSources, before.failedSources, "a later COMPLETED run must recover the source");
    }

    // no run at all -> not failed.
    {
      const before = await deltas();
      await makeSource("no-run");
      const after = await deltas();
      assert.equal(after.failedSources, before.failedSources, "a source with no runs must not count as failed");
    }

    console.log("importMetrics.test.ts: OK");
  } finally {
    await cleanup();
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
