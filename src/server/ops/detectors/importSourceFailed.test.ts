/**
 * import_source_failed detector tests (§21 Step 4, Phase D).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/detectors/importSourceFailed.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { reconcileDetectorSignals } from "../reconciliation";
import type { DetectorContext } from "../types";
import {
  evaluateImportSourceFailed,
  importSourceFailedFingerprint,
  probeImportSourceFailed,
} from "./importSourceFailed";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const DETECTOR = "import_source_failed";
const createdSourceIds: string[] = [];

async function makeSource(
  prisma: PrismaClient,
  overrides: { name: string; isActive?: boolean },
): Promise<string> {
  const source = await prisma.importSource.create({
    data: {
      name: overrides.name,
      slug: `test-import-source-${overrides.name}-${Math.random().toString(36).slice(2)}`,
      type: "WEBSITE",
      isActive: overrides.isActive ?? true,
    },
  });
  createdSourceIds.push(source.id);
  return source.id;
}

async function makeRun(
  prisma: PrismaClient,
  sourceId: string,
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED",
  finishedAt: Date | null,
): Promise<void> {
  await prisma.importRun.create({
    data: { sourceId, status, finishedAt: finishedAt ?? undefined, createdAt: finishedAt ?? new Date() },
  });
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const ctx: DetectorContext = { prisma, fetch, workerStartedAt: new Date() };

  try {
    // 1. Inactive source with a failed run -> no signal.
    {
      const sourceId = await makeSource(prisma, { name: "inactive-failed", isActive: false });
      await makeRun(prisma, sourceId, "FAILED", new Date());
      const probe = await probeImportSourceFailed(ctx);
      assert.equal(probe.outcomes.find((o) => o.sourceId === sourceId), undefined);
    }

    // 2. Active source, latest COMPLETED -> no signal.
    {
      const sourceId = await makeSource(prisma, { name: "active-completed" });
      await makeRun(prisma, sourceId, "COMPLETED", new Date());
      const probe = await probeImportSourceFailed(ctx);
      const outcome = probe.outcomes.find((o) => o.sourceId === sourceId);
      assert.equal(outcome?.status, "COMPLETED");
      const result = evaluateImportSourceFailed({ outcomes: outcome ? [outcome] : [] });
      assert.deepEqual(result.signals, []);
    }

    // 3. Active source, latest FAILED -> WARNING.
    let failedSourceId: string;
    {
      failedSourceId = await makeSource(prisma, { name: "active-failed" });
      await makeRun(prisma, failedSourceId, "FAILED", new Date());
      const probe = await probeImportSourceFailed(ctx);
      const outcome = probe.outcomes.find((o) => o.sourceId === failedSourceId);
      assert.equal(outcome?.status, "FAILED");
      const result = evaluateImportSourceFailed({ outcomes: outcome ? [outcome] : [] });
      assert.equal(result.signals.length, 1);
      assert.equal(result.signals[0].severity, "WARNING");
      assert.equal(result.signals[0].fingerprint, importSourceFailedFingerprint(failedSourceId));
      assert.equal(result.signals[0].entityId, failedSourceId);
    }

    // 4. Multiple active failed sources -> one signal each, distinct fingerprints.
    {
      const idA = await makeSource(prisma, { name: "multi-a" });
      const idB = await makeSource(prisma, { name: "multi-b" });
      await makeRun(prisma, idA, "FAILED", new Date());
      await makeRun(prisma, idB, "FAILED", new Date());
      const probe = await probeImportSourceFailed(ctx);
      const result = evaluateImportSourceFailed(probe);
      const fpA = importSourceFailedFingerprint(idA);
      const fpB = importSourceFailedFingerprint(idB);
      assert.ok(result.signals.some((s) => s.fingerprint === fpA));
      assert.ok(result.signals.some((s) => s.fingerprint === fpB));
      assert.notEqual(fpA, fpB);
    }

    // 5. FAILED then RUNNING -> failure remains (RUNNING doesn't erase it).
    {
      const sourceId = await makeSource(prisma, { name: "failed-then-running" });
      await makeRun(prisma, sourceId, "FAILED", new Date(Date.now() - 60_000));
      await makeRun(prisma, sourceId, "RUNNING", null);
      const probe = await probeImportSourceFailed(ctx);
      const outcome = probe.outcomes.find((o) => o.sourceId === sourceId);
      assert.equal(outcome?.status, "FAILED", "RUNNING is not outcome-bearing, latest FAILED must remain");
    }

    // 6. FAILED then PENDING -> failure remains.
    {
      const sourceId = await makeSource(prisma, { name: "failed-then-pending" });
      await makeRun(prisma, sourceId, "FAILED", new Date(Date.now() - 60_000));
      await makeRun(prisma, sourceId, "PENDING", null);
      const probe = await probeImportSourceFailed(ctx);
      const outcome = probe.outcomes.find((o) => o.sourceId === sourceId);
      assert.equal(outcome?.status, "FAILED");
    }

    // 7. FAILED then successful COMPLETED -> detector reports recovery (miss).
    {
      const sourceId = await makeSource(prisma, { name: "failed-then-completed" });
      await makeRun(prisma, sourceId, "FAILED", new Date(Date.now() - 60_000));
      await makeRun(prisma, sourceId, "COMPLETED", new Date());
      const probe = await probeImportSourceFailed(ctx);
      const outcome = probe.outcomes.find((o) => o.sourceId === sourceId);
      assert.equal(outcome?.status, "COMPLETED");
      const result = evaluateImportSourceFailed({ outcomes: outcome ? [outcome] : [] });
      assert.deepEqual(result.signals, [], "a later successful COMPLETED run must clear the failure");
    }

    // 8. No run at all -> no signal (intentional blind spot, not import_source_silent).
    {
      const sourceId = await makeSource(prisma, { name: "no-run" });
      const probe = await probeImportSourceFailed(ctx);
      assert.equal(probe.outcomes.find((o) => o.sourceId === sourceId), undefined);
    }

    // 9. Fingerprint stable across repeated failed runs.
    {
      const sourceId = await makeSource(prisma, { name: "stable-fingerprint" });
      await makeRun(prisma, sourceId, "FAILED", new Date(Date.now() - 120_000));
      const probe1 = await probeImportSourceFailed(ctx);
      const fp1 = evaluateImportSourceFailed({
        outcomes: probe1.outcomes.filter((o) => o.sourceId === sourceId),
      }).signals[0].fingerprint;

      await makeRun(prisma, sourceId, "FAILED", new Date());
      const probe2 = await probeImportSourceFailed(ctx);
      const fp2 = evaluateImportSourceFailed({
        outcomes: probe2.outcomes.filter((o) => o.sourceId === sourceId),
      }).signals[0].fingerprint;

      assert.equal(fp1, fp2, "fingerprint must not change run-over-run");
    }

    // 10. No NodeRegistry node exists for this detector.
    {
      const { importSourceFailedDetector } = await import("./importSourceFailed");
      assert.deepEqual(importSourceFailedDetector.nodes, []);
    }

    console.log("importSourceFailed.test.ts (probe/evaluate): OK");

    // 11. Reconciliation eventually AUTO-resolves after hysteresis once a
    // successful COMPLETED run becomes current.
    {
      await prisma.operationalSignal.deleteMany({ where: { detector: DETECTOR } });
      const sourceId = await makeSource(prisma, { name: "reconcile-recovery" });
      await makeRun(prisma, sourceId, "FAILED", new Date());

      const failingSignals = () => {
        const outcome = { sourceId, sourceName: "reconcile-recovery", status: "FAILED" as const, finishedAt: new Date(), errorMessage: null };
        return evaluateImportSourceFailed({ outcomes: [outcome] }).signals;
      };

      await reconcileDetectorSignals(prisma, DETECTOR, failingSignals()); // PENDING
      await reconcileDetectorSignals(prisma, DETECTOR, failingSignals()); // OPEN
      let live = await prisma.operationalSignal.findFirst({
        where: { detector: DETECTOR, fingerprint: importSourceFailedFingerprint(sourceId), resolvedAt: null },
      });
      assert.equal(live?.status, "OPEN");

      // Source recovers: 3 consecutive misses (empty current signal set) -> RESOLVED.
      await reconcileDetectorSignals(prisma, DETECTOR, []);
      await reconcileDetectorSignals(prisma, DETECTOR, []);
      const finalCounts = await reconcileDetectorSignals(prisma, DETECTOR, []);
      assert.equal(finalCounts.signalsResolved, 1);

      live = await prisma.operationalSignal.findFirst({
        where: { detector: DETECTOR, fingerprint: importSourceFailedFingerprint(sourceId), resolvedAt: null },
      });
      assert.equal(live, null, "must auto-resolve after 3 consecutive misses");
    }

    console.log("importSourceFailed.test.ts (reconciliation recovery): OK");
  } finally {
    await prisma.operationalSignal.deleteMany({ where: { detector: DETECTOR } });
    await prisma.importRun.deleteMany({ where: { sourceId: { in: createdSourceIds } } });
    await prisma.importSource.deleteMany({ where: { id: { in: createdSourceIds } } });
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
