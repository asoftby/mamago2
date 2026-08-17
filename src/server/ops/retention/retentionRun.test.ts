/**
 * Locked retention execution tests (§21 Step 6, Phases K/N/O).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/retention/retentionRun.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { GlobalLock } from "../lock/GlobalLock";
import { RETENTION_LOCK_NAME, runOperationsRetentionWithLock } from "./retentionRun";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const lock = new GlobalLock(DATABASE_URL!);
  await lock.connect();

  try {
    // 1. Lock name is the frozen explicit constant.
    assert.equal(RETENTION_LOCK_NAME, "operations.retention");

    // 2. Successful run: attempted+succeeded, a real result, lock released afterward.
    {
      const outcome = await runOperationsRetentionWithLock(prisma, lock);
      assert.equal(outcome.attempted, true);
      assert.equal(outcome.succeeded, true);
      assert.ok(outcome.result);
      const reacquired = await lock.tryAcquire(RETENTION_LOCK_NAME);
      assert.equal(reacquired, true, "lock must be free again after the run finishes");
      await lock.release(RETENTION_LOCK_NAME);
    }

    // 3. Lock contention: a second worker skips cleanly, no result, no DetectorRun/OperationalSignal.
    {
      const contender = new GlobalLock(DATABASE_URL!);
      await contender.connect();
      assert.equal(await contender.tryAcquire(RETENTION_LOCK_NAME), true);

      const beforeRuns = await prisma.detectorRun.count();
      const beforeSignals = await prisma.operationalSignal.count();

      const outcome = await runOperationsRetentionWithLock(prisma, lock);
      assert.equal(outcome.attempted, false, "must skip cleanly when the lock is already held");
      assert.equal(outcome.result, null);

      assert.equal(await prisma.detectorRun.count(), beforeRuns, "a skipped cycle must never create a DetectorRun");
      assert.equal(
        await prisma.operationalSignal.count(),
        beforeSignals,
        "a skipped cycle must never create an OperationalSignal",
      );

      await contender.release(RETENTION_LOCK_NAME);
      await contender.close();
    }

    // 4. Failure isolation: an internal error is caught, logged, and never
    // propagates — no DetectorRun/OperationalSignal is created, and the
    // lock is still released for the next scheduled attempt.
    {
      // An unreachable database forces every query to genuinely fail,
      // simulating an unexpected retention-run failure without mocking.
      const brokenPrisma = new PrismaClient({
        datasourceUrl: "postgresql://invalid:invalid@127.0.0.1:1/nonexistent?connect_timeout=2",
      });

      const beforeRuns = await prisma.detectorRun.count();
      const beforeSignals = await prisma.operationalSignal.count();

      const outcome = await runOperationsRetentionWithLock(brokenPrisma, lock);
      assert.equal(outcome.attempted, true, "the attempt itself happened — the lock was acquired");
      assert.equal(outcome.succeeded, false, "a failed run must report succeeded=false, never throw");
      assert.equal(outcome.result, null);

      assert.equal(await prisma.detectorRun.count(), beforeRuns, "a failed run must never create a DetectorRun");
      assert.equal(
        await prisma.operationalSignal.count(),
        beforeSignals,
        "a failed run must never create an OperationalSignal",
      );

      // The lock must still be released even though the run failed.
      const reacquired = await lock.tryAcquire(RETENTION_LOCK_NAME);
      assert.equal(reacquired, true, "lock must be released even after a failed run");
      await lock.release(RETENTION_LOCK_NAME);

      await brokenPrisma.$disconnect();
    }

    // 5. Multi-worker race: two independent GlobalLock connections, only
    // the winner performs deletion; the loser skips cleanly with no error.
    {
      const lockA = new GlobalLock(DATABASE_URL!);
      const lockB = new GlobalLock(DATABASE_URL!);
      await lockA.connect();
      await lockB.connect();
      try {
        const [outcomeA, outcomeB] = await Promise.all([
          runOperationsRetentionWithLock(prisma, lockA),
          runOperationsRetentionWithLock(prisma, lockB),
        ]);

        const attemptedCount = [outcomeA, outcomeB].filter((o) => o.attempted).length;
        assert.equal(attemptedCount, 1, "exactly one of the two racing attempts must have won the lock");
        const succeededCount = [outcomeA, outcomeB].filter((o) => o.succeeded).length;
        assert.equal(succeededCount, 1, "exactly one racing attempt actually performed retention");
      } finally {
        await lockA.close();
        await lockB.close();
      }
    }

    console.log("retentionRun.test.ts: OK");
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
