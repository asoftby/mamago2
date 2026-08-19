/**
 * Node projection tests (§21 Step 3, Phase H).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/snapshot/nodeProjection.test.ts
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
    intervalSec: 60,
    timeoutMs: 5000,
    nodes: [],
    probe: async () => null,
    evaluate: () => ({ samples: [], signals: [] }),
  };
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  try {
    await prisma.operationalSignal.deleteMany({ where: { detector: { in: ["health_endpoint", "db_degraded"] } } });

    // Node with zero registered required detectors -> NO_DATA (vacuous case, never OK).
    __resetDetectorRegistryForTests();
    {
      const nodes = await projectNodeStates(prisma, []);
      const indexability = nodes.find((n) => n.key === "Indexability");
      assert.equal(indexability?.state, "NO_DATA", "Indexability must stay NO_DATA with nothing registered");
    }

    // PROD required detector (health_endpoint) is fresh, no live signals -> OK.
    __resetDetectorRegistryForTests();
    registerDetector(makeDetector("health_endpoint"));
    {
      const summaries = [{ name: "health_endpoint", lastOkAt: new Date(), lastStatus: "OK" as const, isStale: false }];
      const nodes = await projectNodeStates(prisma, summaries);
      const prod = nodes.find((n) => n.key === "PROD");
      assert.equal(prod?.state, "OK", "GREEN = PROVEN OK: fresh detector, no live signal");
    }

    // Required detector is stale -> NO_DATA, even with no live signal.
    {
      const summaries = [{ name: "health_endpoint", lastOkAt: null, lastStatus: null, isStale: true }];
      const nodes = await projectNodeStates(prisma, summaries);
      const prod = nodes.find((n) => n.key === "PROD");
      assert.equal(prod?.state, "NO_DATA");
    }

    // Live CRITICAL signal -> CRITICAL.
    {
      await prisma.operationalSignal.create({
        data: {
          fingerprint: "test.node-proj.critical",
          detector: "health_endpoint",
          type: "T",
          status: "OPEN",
          severity: "CRITICAL",
          title: "t",
          openedAt: new Date(),
          attentionChangedAt: new Date(),
        },
      });
      const summaries = [{ name: "health_endpoint", lastOkAt: new Date(), lastStatus: "OK" as const, isStale: false }];
      const nodes = await projectNodeStates(prisma, summaries);
      const prod = nodes.find((n) => n.key === "PROD");
      assert.equal(prod?.state, "CRITICAL");
      await prisma.operationalSignal.deleteMany({ where: { fingerprint: "test.node-proj.critical" } });
    }

    // Live WARNING only -> WARNING.
    {
      await prisma.operationalSignal.create({
        data: {
          fingerprint: "test.node-proj.warning",
          detector: "health_endpoint",
          type: "T",
          status: "OPEN",
          severity: "WARNING",
          title: "t",
          openedAt: new Date(),
          attentionChangedAt: new Date(),
        },
      });
      const summaries = [{ name: "health_endpoint", lastOkAt: new Date(), lastStatus: "OK" as const, isStale: false }];
      const nodes = await projectNodeStates(prisma, summaries);
      const prod = nodes.find((n) => n.key === "PROD");
      assert.equal(prod?.state, "WARNING");
      await prisma.operationalSignal.deleteMany({ where: { fingerprint: "test.node-proj.warning" } });
    }

    // Snoozed signal still counts toward node state — must NOT turn it green.
    {
      await prisma.operationalSignal.create({
        data: {
          fingerprint: "test.node-proj.snoozed",
          detector: "health_endpoint",
          type: "T",
          status: "OPEN",
          severity: "CRITICAL",
          title: "t",
          openedAt: new Date(),
          attentionChangedAt: new Date(),
          snoozedUntil: new Date(Date.now() + 3_600_000),
        },
      });
      const summaries = [{ name: "health_endpoint", lastOkAt: new Date(), lastStatus: "OK" as const, isStale: false }];
      const nodes = await projectNodeStates(prisma, summaries);
      const prod = nodes.find((n) => n.key === "PROD");
      assert.equal(prod?.state, "CRITICAL", "a snoozed CRITICAL signal must still make the node CRITICAL");
      await prisma.operationalSignal.deleteMany({ where: { fingerprint: "test.node-proj.snoozed" } });
    }

    console.log("nodeProjection.test.ts: OK");
  } finally {
    await prisma.operationalSignal.deleteMany({ where: { fingerprint: { startsWith: "test.node-proj." } } });
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
