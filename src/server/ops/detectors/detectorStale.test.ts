/**
 * detector_stale tests (§21 Step 3, Phase F).
 * Scenarios 1/2/6/7 are pure evaluate() tests. Scenarios 3/4/5/8/9 need
 * real DetectorRun rows and the real DetectorRegistry, so they run against
 * the isolated PostgreSQL DB.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/detectors/detectorStale.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import {
  __resetDetectorRegistryForTests,
  listDetectors,
  registerDetector,
} from "../detectorRegistry";
import {
  detectorStaleFingerprint,
  evaluateDetectorStale,
  probeDetectorStale,
  type DetectorStaleProbe,
} from "./detectorStale";
import type { Detector, DetectorContext } from "../types";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const workerStartedAt = new Date("2026-08-16T12:00:00.000Z");

function probeWith(overrides: Partial<DetectorStaleProbe>): DetectorStaleProbe {
  return { now: new Date("2026-08-16T12:10:00.000Z"), workerStartedAt, targets: [], ...overrides };
}

// ── Pure evaluate() tests ──────────────────────────────────────────────

// 1. Target detector fresh OK -> no signal.
{
  const probe = probeWith({
    targets: [{ name: "health_endpoint", intervalSec: 60, lastOkAt: new Date("2026-08-16T12:09:50.000Z") }],
  });
  const result = evaluateDetectorStale(probe);
  assert.deepEqual(result.signals, []);
}

// 2. Latest OK older than 3x interval -> CRITICAL.
{
  const probe = probeWith({
    now: new Date("2026-08-16T12:10:00.000Z"),
    targets: [{ name: "health_endpoint", intervalSec: 60, lastOkAt: new Date("2026-08-16T12:06:00.000Z") }], // 240s ago > 180s
  });
  const result = evaluateDetectorStale(probe);
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].fingerprint, detectorStaleFingerprint("health_endpoint"));
  assert.equal(result.signals[0].severity, "CRITICAL");
}

// 6. No run during cold-start grace -> NO stale signal.
{
  const probe = probeWith({
    now: new Date("2026-08-16T12:02:00.000Z"), // 120s after worker start, grace = 180s
    targets: [{ name: "health_endpoint", intervalSec: 60, lastOkAt: null }],
  });
  const result = evaluateDetectorStale(probe);
  assert.deepEqual(result.signals, []);
}

// 7. No run after grace -> stale.
{
  const probe = probeWith({
    now: new Date("2026-08-16T12:03:01.000Z"), // 181s after worker start
    targets: [{ name: "health_endpoint", intervalSec: 60, lastOkAt: null }],
  });
  const result = evaluateDetectorStale(probe);
  assert.equal(result.signals.length, 1);
}

console.log("detectorStale.test.ts (pure): OK");

// ── Integration: real DetectorRun rows + real DetectorRegistry ─────────

function makeDetector(name: string, intervalSec = 60): Detector<unknown> {
  return {
    name,
    intervalSec,
    timeoutMs: 5000,
    nodes: [],
    probe: async () => null,
    evaluate: () => ({ samples: [], signals: [] }),
  };
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeRun(detector: string, status: "OK" | "FAILED" | "SKIPPED_LOCKED", finishedAt: Date) {
    await prisma.detectorRun.create({
      data: { detector, status, startedAt: finishedAt, finishedAt, workerId: "test" },
    });
  }

  try {
    __resetDetectorRegistryForTests();
    await prisma.detectorRun.deleteMany({ where: { detector: { startsWith: "test.stale." } } });

    // 3. Recent FAILED but recent OK is still within threshold -> not stale.
    {
      registerDetector(makeDetector("test.stale.a"));
      registerDetector(makeDetector("detector_stale"));
      await makeRun("test.stale.a", "OK", new Date("2026-08-16T13:00:00.000Z"));
      await makeRun("test.stale.a", "FAILED", new Date("2026-08-16T13:00:30.000Z"));

      const ctx = { prisma, fetch, workerStartedAt: new Date("2026-08-16T10:00:00.000Z") } as DetectorContext;
      const probe = await probeDetectorStale(ctx);
      const target = probe.targets.find((t) => t.name === "test.stale.a");
      assert.ok(target);
      assert.equal(target!.lastOkAt?.getTime(), new Date("2026-08-16T13:00:00.000Z").getTime());

      const evalResult = evaluateDetectorStale({ ...probe, now: new Date("2026-08-16T13:01:00.000Z") });
      assert.equal(
        evalResult.signals.find((s) => s.fingerprint === detectorStaleFingerprint("test.stale.a")),
        undefined,
        "a later FAILED run must not affect staleness — last OK is still recent",
      );

      __resetDetectorRegistryForTests();
    }

    // 4. Recent FAILED and last OK outside threshold -> stale.
    {
      await prisma.detectorRun.deleteMany({ where: { detector: "test.stale.b" } });
      registerDetector(makeDetector("test.stale.b"));
      registerDetector(makeDetector("detector_stale"));
      await makeRun("test.stale.b", "OK", new Date("2026-08-16T13:00:00.000Z"));
      await makeRun("test.stale.b", "FAILED", new Date("2026-08-16T13:10:00.000Z"));

      const ctx = { prisma, fetch, workerStartedAt: new Date("2026-08-16T10:00:00.000Z") } as DetectorContext;
      const probe = await probeDetectorStale(ctx);
      const evalResult = evaluateDetectorStale({ ...probe, now: new Date("2026-08-16T13:10:01.000Z") }); // 610s since last OK
      assert.ok(
        evalResult.signals.some((s) => s.fingerprint === detectorStaleFingerprint("test.stale.b")),
        "last OK outside the 3x interval threshold must be stale, regardless of a later FAILED run",
      );

      __resetDetectorRegistryForTests();
    }

    // 5. Only SKIPPED_LOCKED runs exist -> not successful (never ran OK).
    {
      await prisma.detectorRun.deleteMany({ where: { detector: "test.stale.c" } });
      registerDetector(makeDetector("test.stale.c"));
      registerDetector(makeDetector("detector_stale"));
      await makeRun("test.stale.c", "SKIPPED_LOCKED", new Date("2026-08-16T13:00:00.000Z"));

      const ctx = { prisma, fetch, workerStartedAt: new Date("2026-08-16T10:00:00.000Z") } as DetectorContext;
      const probe = await probeDetectorStale(ctx);
      const target = probe.targets.find((t) => t.name === "test.stale.c");
      assert.equal(target?.lastOkAt, null, "SKIPPED_LOCKED must never count as a successful run");

      __resetDetectorRegistryForTests();
    }

    // 8. detector_stale excludes itself.
    {
      registerDetector(makeDetector("test.stale.d"));
      registerDetector(makeDetector("detector_stale"));
      const ctx = { prisma, fetch, workerStartedAt: new Date("2026-08-16T10:00:00.000Z") } as DetectorContext;
      const probe = await probeDetectorStale(ctx);
      assert.equal(
        probe.targets.find((t) => t.name === "detector_stale"),
        undefined,
        "detector_stale must never inspect its own DetectorRun rows",
      );
      __resetDetectorRegistryForTests();
    }

    // 9. A detector without any NodeRegistry mapping is still inspected —
    // proves iteration is over DetectorRegistry, not NodeRegistry.
    {
      const throwaway: Detector<unknown> = { ...makeDetector("test.stale.no-node-mapping"), nodes: [] };
      registerDetector(throwaway);
      registerDetector(makeDetector("detector_stale"));
      const ctx = { prisma, fetch, workerStartedAt: new Date("2026-08-16T10:00:00.000Z") } as DetectorContext;
      const probe = await probeDetectorStale(ctx);
      assert.ok(
        probe.targets.some((t) => t.name === "test.stale.no-node-mapping"),
        "a detector with no NodeRegistry coverage must still be inspected by detector_stale",
      );
      assert.equal(listDetectors().length, 2);
      __resetDetectorRegistryForTests();
    }

    console.log("detectorStale.test.ts (integration): OK");
  } finally {
    await prisma.detectorRun.deleteMany({ where: { detector: { startsWith: "test.stale." } } });
    await prisma.$disconnect();
    __resetDetectorRegistryForTests();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
