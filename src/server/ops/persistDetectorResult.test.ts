/**
 * Executor + persistence wiring tests (§21 Step 3, Phase K).
 * Proves through the REAL executeDetector() + persistDetectorResult() that
 * samples/signals only persist for a completed, successful detector run —
 * FAILED/TIMEOUT/SKIPPED_LOCKED never reconcile or write samples.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/persistDetectorResult.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { executeDetector } from "./detectorRun";
import { GlobalLock, detectorLockName } from "./lock/GlobalLock";
import { persistDetectorResult } from "./persistDetectorResult";
import type { Detector, DetectorContext } from "./types";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

function makeDetector(overrides: Partial<Detector<string>> = {}): Detector<string> {
  return {
    name: "test.persist-wiring",
    intervalSec: 60,
    timeoutMs: 200,
    nodes: [],
    probe: async () => "probe-value",
    evaluate: () => ({ samples: [], signals: [] }),
    ...overrides,
  };
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const lock = new GlobalLock(DATABASE_URL!);
  await lock.connect();
  const workerId = "test-worker";

  async function cleanup(detectorName: string) {
    await prisma.operationalSignal.deleteMany({ where: { detector: detectorName } });
    await prisma.metricSample.deleteMany({ where: { metric: { startsWith: "test.persist-wiring" } } });
    await prisma.detectorRun.deleteMany({ where: { detector: detectorName } });
  }

  try {
    // Successful run: samples written, signal opened after 2 consecutive hits.
    {
      const name = "test.persist-wiring.ok";
      await cleanup(name);
      const detector = makeDetector({
        name,
        evaluate: () => ({
          samples: [{ metric: "test.persist-wiring.metric", value: 42 }],
          signals: [{ fingerprint: "fp-ok", type: "T", severity: "WARNING", title: "t" }],
        }),
      });
      const persistResult = (result: Awaited<ReturnType<typeof detector.evaluate>>) =>
        persistDetectorResult(prisma, name, result);

      const run1 = await executeDetector(detector, {} as DetectorContext, { prisma, lock, workerId, persistResult });
      assert.equal(run1.status, "OK");
      assert.equal(run1.samplesWritten, 1);
      let sampleCount = await prisma.metricSample.count({ where: { metric: "test.persist-wiring.metric" } });
      assert.equal(sampleCount, 1);
      let signal = await prisma.operationalSignal.findFirst({ where: { detector: name, fingerprint: "fp-ok" } });
      assert.equal(signal?.status, "PENDING");

      const run2 = await executeDetector(detector, {} as DetectorContext, { prisma, lock, workerId, persistResult });
      assert.equal(run2.signalsOpened, 1);
      sampleCount = await prisma.metricSample.count({ where: { metric: "test.persist-wiring.metric" } });
      assert.equal(sampleCount, 2, "append-only: second successful run adds a second sample row");
      signal = await prisma.operationalSignal.findFirst({ where: { detector: name, fingerprint: "fp-ok" } });
      assert.equal(signal?.status, "OPEN");

      await cleanup(name);
    }

    // FAILED run: probe throws -> persistResult must never be called, no
    // sample and no signal reconciliation happens.
    {
      const name = "test.persist-wiring.failed";
      await cleanup(name);
      let persistResultCalled = false;
      const detector = makeDetector({
        name,
        probe: async () => {
          throw new Error("boom");
        },
        evaluate: () => ({
          samples: [{ metric: "test.persist-wiring.metric", value: 1 }],
          signals: [{ fingerprint: "fp-failed", type: "T", severity: "WARNING", title: "t" }],
        }),
      });
      const run = await executeDetector(detector, {} as DetectorContext, {
        prisma,
        lock,
        workerId,
        persistResult: async (result) => {
          persistResultCalled = true;
          return persistDetectorResult(prisma, name, result);
        },
      });
      assert.equal(run.status, "FAILED");
      assert.equal(persistResultCalled, false, "persistResult must never be invoked on a FAILED run");
      const sampleCount = await prisma.metricSample.count({ where: { metric: "test.persist-wiring.metric" } });
      assert.equal(sampleCount, 0);
      const signalCount = await prisma.operationalSignal.count({ where: { detector: name } });
      assert.equal(signalCount, 0);
      await cleanup(name);
    }

    // TIMEOUT run: same guarantee.
    {
      const name = "test.persist-wiring.timeout";
      await cleanup(name);
      let persistResultCalled = false;
      const detector = makeDetector({
        name,
        timeoutMs: 30,
        probe: () => new Promise<string>(() => {}),
      });
      const run = await executeDetector(detector, {} as DetectorContext, {
        prisma,
        lock,
        workerId,
        persistResult: async (result) => {
          persistResultCalled = true;
          return persistDetectorResult(prisma, name, result);
        },
      });
      assert.equal(run.status, "TIMEOUT");
      assert.equal(persistResultCalled, false, "persistResult must never be invoked on a TIMEOUT run");
      await cleanup(name);
    }

    // SKIPPED_LOCKED run: same guarantee, and lock is always released after.
    {
      const name = "test.persist-wiring.locked";
      await cleanup(name);
      const contender = new GlobalLock(DATABASE_URL!);
      await contender.connect();
      assert.equal(await contender.tryAcquire(detectorLockName(name)), true);

      let persistResultCalled = false;
      const detector = makeDetector({ name });
      const run = await executeDetector(detector, {} as DetectorContext, {
        prisma,
        lock,
        workerId,
        persistResult: async (result) => {
          persistResultCalled = true;
          return persistDetectorResult(prisma, name, result);
        },
      });
      assert.equal(run.status, "SKIPPED_LOCKED");
      assert.equal(persistResultCalled, false, "persistResult must never be invoked on SKIPPED_LOCKED");

      await contender.release(detectorLockName(name));
      await contender.close();
      await cleanup(name);
    }

    console.log("persistDetectorResult.test.ts: OK");
  } finally {
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
