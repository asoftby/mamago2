/**
 * DetectorRun persistence/execution framework tests (§21 Step 2, Phase F/M).
 * Exercises the real executor against an isolated PostgreSQL DB. The
 * detector used here is a throwaway test double satisfying the Detector<T>
 * interface — it is never registered in DetectorRegistry and ships nowhere.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/detectorRun.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { GlobalLock, detectorLockName } from "./lock/GlobalLock";
import { executeDetector } from "./detectorRun";
import type { Detector, DetectorContext } from "./types";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

function makeDetector(overrides: Partial<Detector<string>> = {}): Detector<string> {
  return {
    name: "test.detector",
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

  try {
    // 1. Successful execution -> OK, zero counts (no persistResult seam wired).
    {
      const detector = makeDetector({ name: "test.detector.ok" });
      const run = await executeDetector(detector, {} as DetectorContext, { prisma, lock, workerId });
      assert.equal(run.status, "OK");
      assert.equal(run.workerId, workerId);
      assert.ok(run.finishedAt, "finishedAt must be set");
      assert.ok(run.durationMs !== null && run.durationMs >= 0);
      assert.equal(run.signalsOpened, 0);
      assert.equal(run.signalsResolved, 0);
      assert.equal(run.samplesWritten, 0);
      assert.equal(run.error, null);
    }

    // persistResult seam: counts get recorded when provided.
    {
      const detector = makeDetector({
        name: "test.detector.persist-seam",
        evaluate: () => ({ samples: [{ metric: "m", value: 1 }], signals: [] }),
      });
      const run = await executeDetector(detector, {} as DetectorContext, {
        prisma,
        lock,
        workerId,
        persistResult: async (result) => ({
          signalsOpened: 0,
          signalsResolved: 0,
          samplesWritten: result.samples.length,
        }),
      });
      assert.equal(run.status, "OK");
      assert.equal(run.samplesWritten, 1);
    }

    // 2. probe() throws -> FAILED, error captured.
    {
      const detector = makeDetector({
        name: "test.detector.failed",
        probe: async () => {
          throw new Error("boom");
        },
      });
      const run = await executeDetector(detector, {} as DetectorContext, { prisma, lock, workerId });
      assert.equal(run.status, "FAILED");
      assert.equal(run.error, "boom");
      assert.ok(run.finishedAt);
    }

    // 3. probe() never resolves within timeoutMs -> TIMEOUT.
    {
      const detector = makeDetector({
        name: "test.detector.timeout",
        timeoutMs: 50,
        probe: () => new Promise<string>(() => {}), // never resolves
      });
      const run = await executeDetector(detector, {} as DetectorContext, { prisma, lock, workerId });
      assert.equal(run.status, "TIMEOUT");
      assert.ok(run.finishedAt);
    }

    // 4. lock already held by another session -> SKIPPED_LOCKED, no RUNNING row created.
    {
      const detectorName = "test.detector.locked";
      const contender = new GlobalLock(DATABASE_URL!);
      await contender.connect();
      assert.equal(await contender.tryAcquire(detectorLockName(detectorName)), true);

      const before = await prisma.detectorRun.count({ where: { detector: detectorName } });
      const detector = makeDetector({ name: detectorName });
      const run = await executeDetector(detector, {} as DetectorContext, { prisma, lock, workerId });
      assert.equal(run.status, "SKIPPED_LOCKED");
      const after = await prisma.detectorRun.count({ where: { detector: detectorName } });
      assert.equal(after, before + 1, "exactly one row (the SKIPPED_LOCKED row) must exist — no RUNNING row");

      await contender.release(detectorLockName(detectorName));
      await contender.close();
    }

    // Lock is always released after execution (detector name reusable immediately).
    {
      const detectorName = "test.detector.lock-released";
      const detector = makeDetector({ name: detectorName });
      await executeDetector(detector, {} as DetectorContext, { prisma, lock, workerId });
      const reacquired = await lock.tryAcquire(detectorLockName(detectorName));
      assert.equal(reacquired, true, "lock must be free again after executeDetector finishes");
      await lock.release(detectorLockName(detectorName));
    }

    console.log("detectorRun.test.ts: OK");
  } finally {
    await prisma.detectorRun.deleteMany({ where: { workerId } });
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
