import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { prettyCanonicalJson } from "../src/lib/migration/planning/user-ownership/canonicalJson";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "../src/lib/migration/planning/user-ownership/readOnlyRepository";
import { reconcileBusinessLinkedTail } from "../src/lib/migration/planning/business-linked-tail";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 11: fully read-only reconciliation for exactly the 2
 * business-linked users left out of the Slice 7/8/9/10 write batches —
 * `wordpress-db:user:89` and `wordpress-db:user:130`. Fail-closed without
 * explicit `--read-only`, mirroring the Slice 6 analyzer.
 */
const TARGET_SOURCE_RECORD_KEYS = ["wordpress-db:user:89", "wordpress-db:user:130"];

interface Args {
  snapshotRoot: string;
  outputDir: string;
}

function parseArgs(argv: readonly string[]): Args {
  if (!argv.includes("--read-only")) throw new Error("Refusing to run without explicit --read-only.");
  const rootIndex = argv.indexOf("--snapshot-root");
  const outputIndex = argv.indexOf("--output-dir");
  if (rootIndex < 0 || !argv[rootIndex + 1]) throw new Error("Requires --snapshot-root.");
  if (outputIndex < 0 || !argv[outputIndex + 1]) throw new Error("Requires --output-dir.");
  return { snapshotRoot: argv[rootIndex + 1], outputDir: argv[outputIndex + 1] };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertLocalDatabaseUrl(process.env.DATABASE_URL);

  const prisma = new PrismaClient();
  try {
    const readOnlyClient = createReadOnlyPrismaClient(prisma);
    const repository = createUserOwnershipReadOnlyRepository(readOnlyClient);

    const before = await repository.captureBaselineCounts();
    const entries = await reconcileBusinessLinkedTail(readOnlyClient, args.snapshotRoot, TARGET_SOURCE_RECORD_KEYS);
    const after = await repository.captureBaselineCounts();

    for (const key of Object.keys(before) as Array<keyof typeof before>) {
      if (before[key] !== after[key]) throw new Error(`BLOCKED_UNEXPECTED_DB_MUTATION:${key}:${before[key]}->${after[key]}`);
    }

    mkdirSync(args.outputDir, { recursive: true });
    writeFileSync(join(args.outputDir, "business-linked-tail-reconciliation.json"), prettyCanonicalJson(entries));

    console.log(JSON.stringify({ decision: "SLICE_11_RECONCILIATION_READY", databaseWrites: 0, baselineDelta: 0, entries }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
