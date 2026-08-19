/**
 * MetricCollector execution framework tests (§21 Step 5, Phase P).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectorRun.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { GlobalLock } from "../lock/GlobalLock";
import { metricCollectorLockName, runMetricCollector } from "./collectorRun";
import type { MetricCollector } from "./types";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

function makeCollector(overrides: Partial<MetricCollector> = {}): MetricCollector {
  return {
    name: "test.collector",
    intervalSec: 300,
    timeoutMs: 200,
    collect: async () => [{ metric: "test.metric", value: 1 }],
    ...overrides,
  };
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const lock = new GlobalLock(DATABASE_URL!);
  await lock.connect();

  async function cleanup(metric: string) {
    await prisma.metricSample.deleteMany({ where: { metric } });
  }

  try {
    // 1. Successful collector: append-only rows written.
    {
      const collector = makeCollector({ name: "test.ok", collect: async () => [{ metric: "test.ok.metric", value: 42 }] });
      const result = await runMetricCollector(collector, { prisma, lock });
      assert.equal(result.attempted, true);
      assert.equal(result.succeeded, true);
      assert.equal(result.samplesWritten, 1);
      const rows = await prisma.metricSample.findMany({ where: { metric: "test.ok.metric" } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].value, 42);
      await cleanup("test.ok.metric");
    }

    // 2. Second successful run appends rather than updates.
    {
      const collector = makeCollector({
        name: "test.append",
        collect: async () => [{ metric: "test.append.metric", value: 1 }],
      });
      await runMetricCollector(collector, { prisma, lock });
      await runMetricCollector(collector, { prisma, lock });
      const rows = await prisma.metricSample.findMany({ where: { metric: "test.append.metric" } });
      assert.equal(rows.length, 2, "two runs must produce two rows, never an update");
      await cleanup("test.append.metric");
    }

    // 3. Batch samples share one DB-derived collectedAt.
    {
      const collector = makeCollector({
        name: "test.batch",
        collect: async () => [
          { metric: "test.batch.a", value: 1 },
          { metric: "test.batch.b", value: 2 },
        ],
      });
      const result = await runMetricCollector(collector, { prisma, lock });
      assert.equal(result.samplesWritten, 2);
      const [a] = await prisma.metricSample.findMany({ where: { metric: "test.batch.a" } });
      const [b] = await prisma.metricSample.findMany({ where: { metric: "test.batch.b" } });
      assert.equal(a.collectedAt.getTime(), b.collectedAt.getTime(), "same batch must share one collectedAt");
      await cleanup("test.batch.a");
      await cleanup("test.batch.b");
    }

    // 4. Collector exception => no samples.
    {
      const collector = makeCollector({
        name: "test.throws",
        collect: async () => {
          throw new Error("boom");
        },
      });
      const result = await runMetricCollector(collector, { prisma, lock });
      assert.equal(result.succeeded, false);
      assert.equal(result.samplesWritten, 0);
      const rows = await prisma.metricSample.count({ where: { metric: { startsWith: "test.throws" } } });
      assert.equal(rows, 0);
    }

    // 4b. Timeout => no samples (partial-collection guarantee under timeout).
    {
      const collector = makeCollector({
        name: "test.timeout",
        timeoutMs: 30,
        collect: () => new Promise(() => {}), // never resolves
      });
      const result = await runMetricCollector(collector, { prisma, lock });
      assert.equal(result.succeeded, false);
      assert.equal(result.samplesWritten, 0);
    }

    // 5. Empty batch (legitimate skip, e.g. zero-denominator ratio) writes nothing but succeeds.
    {
      const collector = makeCollector({ name: "test.empty", collect: async () => [] });
      const result = await runMetricCollector(collector, { prisma, lock });
      assert.equal(result.succeeded, true);
      assert.equal(result.samplesWritten, 0);
    }

    // 6. Lock acquired/released — name follows metric_collector:<name>, and
    // it's free again after the run.
    {
      const name = "test.lock-released";
      const collector = makeCollector({ name });
      assert.equal(metricCollectorLockName(name), `metric_collector:${name}`);
      await runMetricCollector(collector, { prisma, lock });
      const reacquired = await lock.tryAcquire(metricCollectorLockName(name));
      assert.equal(reacquired, true, "lock must be free again after the run finishes");
      await lock.release(metricCollectorLockName(name));
    }

    // 7. Lock contention => skipped (attempted: false), no write.
    {
      const name = "test.locked";
      const contender = new GlobalLock(DATABASE_URL!);
      await contender.connect();
      assert.equal(await contender.tryAcquire(metricCollectorLockName(name)), true);

      const collector = makeCollector({ name, collect: async () => [{ metric: "test.locked.metric", value: 1 }] });
      const result = await runMetricCollector(collector, { prisma, lock });
      assert.equal(result.attempted, false);
      const rows = await prisma.metricSample.count({ where: { metric: "test.locked.metric" } });
      assert.equal(rows, 0);

      await contender.release(metricCollectorLockName(name));
      await contender.close();
    }

    // 8. Collector never creates a DetectorRun or OperationalSignal.
    {
      const collector = makeCollector({
        name: "test.no-detector-run",
        collect: async () => [{ metric: "test.no-detector-run.metric", value: 1 }],
      });
      const beforeRuns = await prisma.detectorRun.count();
      const beforeSignals = await prisma.operationalSignal.count();
      await runMetricCollector(collector, { prisma, lock });
      const afterRuns = await prisma.detectorRun.count();
      const afterSignals = await prisma.operationalSignal.count();
      assert.equal(afterRuns, beforeRuns, "must never create a DetectorRun");
      assert.equal(afterSignals, beforeSignals, "must never create an OperationalSignal");
      await cleanup("test.no-detector-run.metric");
    }

    // 9. Concurrency: same collector cannot write concurrently under two GlobalLocks.
    {
      const name = "test.concurrent";
      const lockA = new GlobalLock(DATABASE_URL!);
      const lockB = new GlobalLock(DATABASE_URL!);
      await lockA.connect();
      await lockB.connect();
      try {
        let concurrentRuns = 0;
        let maxConcurrent = 0;
        const collector = makeCollector({
          name,
          collect: async () => {
            concurrentRuns += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrentRuns);
            await new Promise((r) => setTimeout(r, 50));
            concurrentRuns -= 1;
            return [{ metric: "test.concurrent.metric", value: 1 }];
          },
        });

        const [resultA, resultB] = await Promise.all([
          runMetricCollector(collector, { prisma, lock: lockA }),
          runMetricCollector(collector, { prisma, lock: lockB }),
        ]);

        assert.equal(maxConcurrent, 1, "collect() must never run concurrently with itself");
        const attemptedCount = [resultA, resultB].filter((r) => r.attempted).length;
        assert.equal(attemptedCount, 1, "exactly one of the two overlapping calls must have won the lock");
        await cleanup("test.concurrent.metric");
      } finally {
        await lockA.close();
        await lockB.close();
      }
    }

    console.log("collectorRun.test.ts: OK");
  } finally {
    await prisma.metricSample.deleteMany({ where: { metric: { startsWith: "test." } } });
    await prisma.$disconnect();
    await lock.close();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
