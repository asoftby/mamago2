/**
 * Step 4 failure-semantics regression (§21 Step 4, Phase K): a real
 * registered Step 4 detector (global_noindex) exercised through the
 * actual executor — a probe() transport failure must record FAILED and
 * must NOT reconcile any previous signal as a miss.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/detectors/step4FailureSemantics.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { executeDetector } from "../detectorRun";
import { GlobalLock, detectorLockName } from "../lock/GlobalLock";
import { persistDetectorResult } from "../persistDetectorResult";
import type { DetectorContext } from "../types";
import { globalNoindexDetector, GLOBAL_NOINDEX_FINGERPRINT } from "./globalNoindex";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const lock = new GlobalLock(DATABASE_URL!);
  await lock.connect();
  const workerId = "test-worker";

  try {
    await prisma.operationalSignal.deleteMany({ where: { detector: globalNoindexDetector.name } });

    // Seed a pre-existing live OPEN signal for this detector, as if a
    // previous successful run had already found the site noindexed.
    await prisma.operationalSignal.create({
      data: {
        fingerprint: GLOBAL_NOINDEX_FINGERPRINT,
        detector: globalNoindexDetector.name,
        type: "GLOBAL_NOINDEX",
        status: "OPEN",
        severity: "CRITICAL",
        title: "pre-existing",
        openedAt: new Date(),
        attentionChangedAt: new Date(),
        consecutiveHits: 2,
      },
    });

    // APP_PUBLIC_URL left unset/unreachable on purpose: nothing listens on
    // that host, so probeGlobalNoindex() throws a real network error.
    process.env.APP_PUBLIC_URL = "http://127.0.0.1:1"; // port 1: nothing listens
    const ctx: DetectorContext = { prisma, fetch, workerStartedAt: new Date() };

    const run = await executeDetector(globalNoindexDetector, ctx, {
      prisma,
      lock,
      workerId,
      persistResult: (result) => persistDetectorResult(prisma, globalNoindexDetector.name, result),
    });

    assert.equal(run.status, "FAILED", "a transport failure must record FAILED, not OK");
    assert.equal(run.signalsOpened, 0);
    assert.equal(run.signalsResolved, 0);

    const stillLive = await prisma.operationalSignal.findFirst({
      where: { detector: globalNoindexDetector.name, fingerprint: GLOBAL_NOINDEX_FINGERPRINT, resolvedAt: null },
    });
    assert.equal(stillLive?.status, "OPEN", "the pre-existing live signal must be untouched — not reconciled as a miss");
    assert.equal(stillLive?.consecutiveHits, 2, "hit/miss counters must not move on a FAILED run");

    const reacquired = await lock.tryAcquire(detectorLockName(globalNoindexDetector.name));
    assert.equal(reacquired, true, "lock must still be released after a FAILED run");
    await lock.release(detectorLockName(globalNoindexDetector.name));

    console.log("step4FailureSemantics.test.ts: OK");
  } finally {
    delete process.env.APP_PUBLIC_URL;
    await prisma.operationalSignal.deleteMany({ where: { detector: globalNoindexDetector.name } });
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
