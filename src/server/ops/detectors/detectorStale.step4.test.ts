/**
 * detector_stale Step 4 regression (§21 Step 4, Phase G): after
 * registering all seven detectors, detector_stale must automatically
 * monitor the six non-meta ones — derived from DetectorRegistry, never a
 * hardcoded list — including the two nodes=[] Step 4 detectors.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/detectors/detectorStale.step4.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { __resetDetectorRegistryForTests, listDetectors } from "../detectorRegistry";
import type { DetectorContext } from "../types";
import { registerCoreDetectors } from "./index";
import { probeDetectorStale } from "./detectorStale";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  try {
    __resetDetectorRegistryForTests();
    registerCoreDetectors();

    assert.equal(listDetectors().length, 7, "exactly seven detectors registered");
    const names = listDetectors()
      .map((d) => d.name)
      .sort();
    assert.deepEqual(names, [
      "db_degraded",
      "detector_stale",
      "global_noindex",
      "health_endpoint",
      "import_source_failed",
      "moderation_queue_stale",
      "sitemap_unavailable",
    ]);

    const ctx: DetectorContext = { prisma, fetch, workerStartedAt: new Date() };
    const probe = await probeDetectorStale(ctx);
    const targetNames = probe.targets.map((t) => t.name).sort();

    assert.deepEqual(
      targetNames,
      [
        "db_degraded",
        "global_noindex",
        "health_endpoint",
        "import_source_failed",
        "moderation_queue_stale",
        "sitemap_unavailable",
      ],
      "detector_stale must monitor exactly the six non-meta detectors, derived from the registry",
    );
    assert.ok(!targetNames.includes("detector_stale"), "must exclude itself");

    // The two nodes=[] Step 4 detectors are still covered.
    assert.ok(targetNames.includes("import_source_failed"));
    assert.ok(targetNames.includes("moderation_queue_stale"));

    // Cold-start grace for a fresh 300s-interval detector: 3 * 300 = 900s.
    const importTarget = probe.targets.find((t) => t.name === "import_source_failed");
    assert.equal(importTarget?.intervalSec, 300);

    console.log("detectorStale.step4.test.ts: OK");
  } finally {
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
