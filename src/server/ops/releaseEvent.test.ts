/**
 * ReleaseEvent observation tests (§21 Step 3, Phase I).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/releaseEvent.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { GlobalLock } from "./lock/GlobalLock";
import { observeReleaseEvent } from "./releaseEvent";
import { buildSnapshot } from "./snapshot/buildSnapshot";
import type { OperationsSnapshotPayload } from "./snapshot/payload";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

async function cleanup(prisma: PrismaClient): Promise<void> {
  await prisma.releaseEvent.deleteMany({});
  await prisma.operationsSnapshot.deleteMany({ where: { id: "current" } });
}

async function main() {
  let prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  try {
    await cleanup(prisma);

    // A. First-ever observation -> establish baseline, 0 ReleaseEvent rows.
    const t0 = new Date("2026-08-16T12:00:00.000Z");
    const first = await observeReleaseEvent(prisma, { buildId: "dev-100", gitSha: "sha-a", processStartedAt: t0 });
    assert.equal(first.kind, null, "first observation must not invent BUILD_CHANGED");
    assert.equal(await prisma.releaseEvent.count(), 0, "A: first-ever observation -> 0 ReleaseEvent rows");

    const snapAfterFirst = await prisma.operationsSnapshot.findUniqueOrThrow({ where: { id: "current" } });
    const baseline1 = (snapAfterFirst.payload as unknown as OperationsSnapshotPayload).observedRuntime;
    assert.ok(baseline1, "baseline must be persisted on OperationsSnapshot.payload");
    assert.equal(baseline1.buildId, "dev-100");
    assert.equal(baseline1.processStartedAt, t0.toISOString());

    // B. Repeated same runtime -> still 0.
    const again = await observeReleaseEvent(prisma, { buildId: "dev-100", gitSha: "sha-a", processStartedAt: t0 });
    assert.equal(again.kind, null);
    assert.equal(await prisma.releaseEvent.count(), 0, "B: repeated same runtime -> still 0");

    // C. Baseline survives simulated worker restart/reload:
    //    new PrismaClient + a snapshot-builder cycle must preserve observedRuntime.
    await prisma.$disconnect();
    prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
    const lock = new GlobalLock(DATABASE_URL!);
    await lock.connect();
    try {
      const built = await buildSnapshot({
        prisma,
        lock,
        workerStartedAt: new Date("2026-08-16T11:00:00.000Z"),
      });
      assert.equal(built.accepted, true);
      const afterBuild = await prisma.operationsSnapshot.findUniqueOrThrow({ where: { id: "current" } });
      const preserved = (afterBuild.payload as unknown as OperationsSnapshotPayload).observedRuntime;
      assert.deepEqual(preserved, baseline1, "C: snapshot rebuild must preserve observedRuntime baseline");

      const afterReload = await observeReleaseEvent(prisma, {
        buildId: "dev-100",
        gitSha: "sha-a",
        processStartedAt: t0,
      });
      assert.equal(afterReload.kind, null);
      assert.equal(await prisma.releaseEvent.count(), 0, "C: worker reload must not invent an event");
    } finally {
      await lock.close();
    }

    // D. Same build + changed processStartedAt -> exactly one PROCESS_RESTART.
    const t1 = new Date("2026-08-16T13:00:00.000Z");
    const restarted = await observeReleaseEvent(prisma, {
      buildId: "dev-100",
      gitSha: "sha-a",
      processStartedAt: t1,
    });
    assert.equal(restarted.kind, "PROCESS_RESTART");
    assert.equal(await prisma.releaseEvent.count(), 1, "D: exactly one PROCESS_RESTART");
    assert.equal((await prisma.releaseEvent.findFirstOrThrow()).kind, "PROCESS_RESTART");

    // E. Changed build -> exactly one BUILD_CHANGED.
    const t2 = new Date("2026-08-16T14:00:00.000Z");
    const deployed = await observeReleaseEvent(prisma, {
      buildId: "dev-101",
      gitSha: "sha-b",
      processStartedAt: t2,
    });
    assert.equal(deployed.kind, "BUILD_CHANGED");
    assert.equal(await prisma.releaseEvent.count(), 2, "E: exactly one BUILD_CHANGED (total 2 rows)");

    // F. Repeated observation of changed runtime -> no duplicate.
    for (let i = 0; i < 5; i++) {
      const noop = await observeReleaseEvent(prisma, {
        buildId: "dev-101",
        gitSha: "sha-b",
        processStartedAt: t2,
      });
      assert.equal(noop.kind, null);
    }
    assert.equal(await prisma.releaseEvent.count(), 2, "F: repeated observation must not duplicate");

    // G. Concurrent observation remains idempotent.
    const t3 = new Date("2026-08-16T15:00:00.000Z");
    const [a, b] = await Promise.all([
      observeReleaseEvent(prisma, { buildId: "dev-102", gitSha: "sha-c", processStartedAt: t3 }),
      observeReleaseEvent(prisma, { buildId: "dev-102", gitSha: "sha-c", processStartedAt: t3 }),
    ]);
    const kinds = [a.kind, b.kind];
    assert.ok(
      kinds.every((k) => k === "BUILD_CHANGED" || k === null),
      "G: kinds must be BUILD_CHANGED or null only",
    );
    assert.ok(kinds.includes("BUILD_CHANGED"), "G: one concurrent caller must observe BUILD_CHANGED");
    const rowsForT3 = await prisma.releaseEvent.count({
      where: { buildId: "dev-102", processStartedAt: t3 },
    });
    assert.equal(rowsForT3, 1, "G: concurrent observation must remain idempotent at the row level");
    assert.equal(await prisma.releaseEvent.count(), 3);

    console.log("releaseEvent.test.ts: OK");
  } finally {
    await cleanup(prisma).catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
