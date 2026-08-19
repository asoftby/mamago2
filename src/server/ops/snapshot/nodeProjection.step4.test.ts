/**
 * Indexability node projection tests (§21 Step 4, Phase H).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/snapshot/nodeProjection.step4.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { __resetDetectorRegistryForTests, registerDetector } from "../detectorRegistry";
import type { Detector } from "../types";
import { projectNodeStates } from "./nodeProjection";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

function makeDetector(name: string): Detector<unknown> {
  return {
    name,
    intervalSec: 300,
    timeoutMs: 5000,
    nodes: ["Indexability"],
    probe: async () => null,
    evaluate: () => ({ samples: [], signals: [] }),
  };
}

const FRESH = { lastOkAt: new Date(), lastStatus: "OK" as const, isStale: false };
const STALE = { lastOkAt: null, lastStatus: null, isStale: true };

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function clearSignals() {
    await prisma.operationalSignal.deleteMany({
      where: { detector: { in: ["global_noindex", "sitemap_unavailable"] } },
    });
  }

  try {
    __resetDetectorRegistryForTests();
    registerDetector(makeDetector("global_noindex"));
    registerDetector(makeDetector("sitemap_unavailable"));
    await clearSignals();

    // global_noindex stale -> Indexability NO_DATA (even if sitemap is fresh/clean).
    {
      const summaries = [
        { name: "global_noindex", ...STALE },
        { name: "sitemap_unavailable", ...FRESH },
      ];
      const nodes = await projectNodeStates(prisma, summaries);
      assert.equal(nodes.find((n) => n.key === "Indexability")?.state, "NO_DATA");
    }

    // Both fresh, no open signals -> Indexability OK.
    {
      const summaries = [
        { name: "global_noindex", ...FRESH },
        { name: "sitemap_unavailable", ...FRESH },
      ];
      const nodes = await projectNodeStates(prisma, summaries);
      assert.equal(nodes.find((n) => n.key === "Indexability")?.state, "OK");
    }

    // global_noindex OPEN CRITICAL -> Indexability CRITICAL.
    {
      await prisma.operationalSignal.create({
        data: {
          fingerprint: "test.indexability.critical",
          detector: "global_noindex",
          type: "T",
          status: "OPEN",
          severity: "CRITICAL",
          title: "t",
          openedAt: new Date(),
          attentionChangedAt: new Date(),
        },
      });
      const summaries = [
        { name: "global_noindex", ...FRESH },
        { name: "sitemap_unavailable", ...FRESH },
      ];
      const nodes = await projectNodeStates(prisma, summaries);
      assert.equal(nodes.find((n) => n.key === "Indexability")?.state, "CRITICAL");
      await clearSignals();
    }

    // sitemap WARNING -> Indexability WARNING.
    {
      await prisma.operationalSignal.create({
        data: {
          fingerprint: "test.indexability.warning",
          detector: "sitemap_unavailable",
          type: "T",
          status: "OPEN",
          severity: "WARNING",
          title: "t",
          openedAt: new Date(),
          attentionChangedAt: new Date(),
        },
      });
      const summaries = [
        { name: "global_noindex", ...FRESH },
        { name: "sitemap_unavailable", ...FRESH },
      ];
      const nodes = await projectNodeStates(prisma, summaries);
      assert.equal(nodes.find((n) => n.key === "Indexability")?.state, "WARNING");
      await clearSignals();
    }

    // sitemap CRITICAL -> Indexability CRITICAL.
    {
      await prisma.operationalSignal.create({
        data: {
          fingerprint: "test.indexability.sitemap-critical",
          detector: "sitemap_unavailable",
          type: "T",
          status: "OPEN",
          severity: "CRITICAL",
          title: "t",
          openedAt: new Date(),
          attentionChangedAt: new Date(),
        },
      });
      const summaries = [
        { name: "global_noindex", ...FRESH },
        { name: "sitemap_unavailable", ...FRESH },
      ];
      const nodes = await projectNodeStates(prisma, summaries);
      assert.equal(nodes.find((n) => n.key === "Indexability")?.state, "CRITICAL");
      await clearSignals();
    }

    // Snoozed global_noindex signal STILL affects Indexability — must not turn it green.
    {
      await prisma.operationalSignal.create({
        data: {
          fingerprint: "test.indexability.snoozed",
          detector: "global_noindex",
          type: "T",
          status: "OPEN",
          severity: "CRITICAL",
          title: "t",
          openedAt: new Date(),
          attentionChangedAt: new Date(),
          snoozedUntil: new Date(Date.now() + 3_600_000),
        },
      });
      const summaries = [
        { name: "global_noindex", ...FRESH },
        { name: "sitemap_unavailable", ...FRESH },
      ];
      const nodes = await projectNodeStates(prisma, summaries);
      assert.equal(
        nodes.find((n) => n.key === "Indexability")?.state,
        "CRITICAL",
        "a snoozed CRITICAL signal must still color Indexability, not hide it into OK",
      );
      await clearSignals();
    }

    console.log("nodeProjection.step4.test.ts: OK");
  } finally {
    await clearSignals();
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
