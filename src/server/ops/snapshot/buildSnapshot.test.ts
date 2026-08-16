/**
 * Singleton snapshot builder regression tests (§21 Step 2, Phase M).
 * This is the mandatory regression test protecting the architecture-freeze
 * bug fixed in revision 1.2.1: a write must never be accepted unless its
 * startedAt is strictly newer than what's already stored.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/snapshot/buildSnapshot.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { GlobalLock } from "../lock/GlobalLock";
import { buildSnapshot, upsertSnapshotMonotonic } from "./buildSnapshot";
import { emptySnapshotPayload } from "./payload";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const workerStartedAt = new Date();

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const lockA = new GlobalLock(DATABASE_URL!);
  await lockA.connect();

  try {
    await prisma.operationsSnapshot.deleteMany({ where: { id: "current" } });

    // 1. First build creates id = "current".
    const first = await buildSnapshot({ prisma, lock: lockA, workerStartedAt });
    assert.equal(first.attempted, true);
    assert.equal(first.accepted, true);
    const row1 = await prisma.operationsSnapshot.findUniqueOrThrow({ where: { id: "current" } });
    assert.equal(row1.id, "current");

    // 2. Repeated builds: still exactly ONE OperationsSnapshot row.
    await buildSnapshot({ prisma, lock: lockA, workerStartedAt });
    await buildSnapshot({ prisma, lock: lockA, workerStartedAt });
    const count = await prisma.operationsSnapshot.count();
    assert.equal(count, 1, "must remain a true singleton across repeated builds");

    // 7. startedAt is a DB-observed timestamp and advances across real builds.
    const row2 = await prisma.operationsSnapshot.findUniqueOrThrow({ where: { id: "current" } });
    assert.ok(
      row2.startedAt.getTime() >= row1.startedAt.getTime(),
      "startedAt must not go backwards across successive real builds",
    );

    // 3 & 4: direct control over startedAt to prove monotonicity precisely.
    const newer = new Date(row2.startedAt.getTime() + 60_000);
    const older = new Date(row2.startedAt.getTime() - 60_000);

    const newerPayload = { ...emptySnapshotPayload(), kpis: { marker: "newer" } };
    const acceptedNewer = await upsertSnapshotMonotonic(prisma, {
      startedAt: newer,
      payload: newerPayload,
    });
    assert.equal(acceptedNewer.accepted, true, "a strictly newer startedAt must be accepted");
    const afterNewer = await prisma.operationsSnapshot.findUniqueOrThrow({ where: { id: "current" } });
    assert.deepEqual(afterNewer.payload, newerPayload);
    const generatedAtAfterNewer = afterNewer.generatedAt;

    // 4. An attempted write carrying an OLDER startedAt CANNOT replace newer payload.
    const staleePayload = { ...emptySnapshotPayload(), kpis: { marker: "stale-must-not-apply" } };
    const acceptedOlder = await upsertSnapshotMonotonic(prisma, {
      startedAt: older,
      payload: staleePayload,
    });
    assert.equal(acceptedOlder.accepted, false, "an older startedAt must be rejected");
    const afterOlder = await prisma.operationsSnapshot.findUniqueOrThrow({ where: { id: "current" } });
    assert.deepEqual(
      afterOlder.payload,
      newerPayload,
      "rejected write must not have modified the stored payload",
    );
    assert.equal(afterOlder.startedAt.getTime(), newer.getTime());

    // 6. generatedAt changes only on a successful accepted build — a
    // rejected write must leave generatedAt untouched.
    assert.equal(
      afterOlder.generatedAt.getTime(),
      generatedAtAfterNewer.getTime(),
      "generatedAt must not change when the write was rejected",
    );

    // 5. Builder lock prevents two builders from collecting concurrently.
    // Reset the row first — the monotonicity checks above deliberately left
    // a startedAt 60s in the *future* relative to real time, which would
    // otherwise reject every subsequent real build until wall-clock time
    // caught up.
    await prisma.operationsSnapshot.deleteMany({ where: { id: "current" } });
    const lockB = new GlobalLock(DATABASE_URL!);
    await lockB.connect();
    try {
      const heldByA = await lockA.tryAcquire("operations.snapshot_builder");
      assert.equal(heldByA, true, "lockA re-acquires (same session already released after prior builds)");

      // While A holds the lock, B's build attempt must be skipped, not collect.
      const skipped = await buildSnapshot({ prisma, lock: lockB, workerStartedAt });
      assert.equal(skipped.attempted, false, "B must skip the cycle while A holds the builder lock");

      await lockA.release("operations.snapshot_builder");

      // Now B can build successfully.
      const recovered = await buildSnapshot({ prisma, lock: lockB, workerStartedAt });
      assert.equal(recovered.attempted, true);
      assert.equal(recovered.accepted, true);
    } finally {
      await lockB.close();
    }

    console.log("buildSnapshot.test.ts: OK");
  } finally {
    await prisma.operationsSnapshot.deleteMany({ where: { id: "current" } });
    await prisma.$disconnect();
    await lockA.close();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
