import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";

import { buildPhoenixAdapterRegistry } from "./registry";
import type { PhoenixReleaseManifest } from "../types";

function realManifest(): PhoenixReleaseManifest {
  return JSON.parse(readFileSync("docs/migration/releases/phoenix-approved-2026-07-30.json", "utf8")) as PhoenixReleaseManifest;
}

const STOP_SENTINEL = "STOP_AFTER_CONSISTENCY_CHECK";

/** A Prisma stub that only ever proves whether the registry reached a real DB call — it never actually connects. */
function stubPrisma(): PrismaClient {
  return {
    migrationSource: {
      upsert: async () => {
        throw new Error(STOP_SENTINEL);
      },
    },
  } as unknown as PrismaClient;
}

async function testConsistentRealManifestPassesStructuralChecks(): Promise<void> {
  await assert.rejects(
    buildPhoenixAdapterRegistry({ prisma: stubPrisma(), artifactRoot: "/nonexistent", manifest: realManifest() }),
    (error: Error) => error.message === STOP_SENTINEL,
    "the real committed manifest must pass every REGISTRY_* structural check before ever touching Prisma",
  );
}

async function testMissingPhaseInManifestPhaseOrderBlocksBeforeWrites(): Promise<void> {
  const manifest = realManifest();
  manifest.phaseOrder = manifest.phaseOrder.filter((name) => name !== "routes");
  await assert.rejects(
    buildPhoenixAdapterRegistry({ prisma: stubPrisma(), artifactRoot: "/nonexistent", manifest }),
    (error: Error) => error.message === "RELEASE_BLOCKED:REGISTRY_MANIFEST_PHASE_MISMATCH:routes",
  );
}

async function testReorderedPhaseOrderBlocksBeforeWrites(): Promise<void> {
  const manifest = realManifest();
  const routesIndex = manifest.phaseOrder.indexOf("routes");
  const eventsIndex = manifest.phaseOrder.indexOf("events");
  [manifest.phaseOrder[routesIndex], manifest.phaseOrder[eventsIndex]] = [manifest.phaseOrder[eventsIndex], manifest.phaseOrder[routesIndex]];
  await assert.rejects(
    buildPhoenixAdapterRegistry({ prisma: stubPrisma(), artifactRoot: "/nonexistent", manifest }),
    (error: Error) => error.message.startsWith("RELEASE_BLOCKED:REGISTRY_PHASE_ORDER_MISMATCH:"),
  );
}

async function testReadyPhaseWithoutRegisteredAdapterBlocksBeforeWrites(): Promise<void> {
  const manifest = realManifest();
  const redirects = manifest.phases.find((phase) => phase.name === "redirects")!;
  (redirects as { status: string }).status = "READY";
  await assert.rejects(
    buildPhoenixAdapterRegistry({ prisma: stubPrisma(), artifactRoot: "/nonexistent", manifest }),
    (error: Error) => error.message === "RELEASE_BLOCKED:REGISTRY_ADAPTER_MISSING:redirects",
  );
}

async function main(): Promise<void> {
  await testConsistentRealManifestPassesStructuralChecks();
  await testMissingPhaseInManifestPhaseOrderBlocksBeforeWrites();
  await testReorderedPhaseOrderBlocksBeforeWrites();
  await testReadyPhaseWithoutRegisteredAdapterBlocksBeforeWrites();
  console.log("Phoenix adapter registry tests: PASS");
}

void main();
