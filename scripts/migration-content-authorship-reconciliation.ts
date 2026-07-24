import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { prettyCanonicalJson } from "../src/lib/migration/planning/user-ownership/canonicalJson";
import { planContentAuthorship } from "../src/lib/migration/planning/user-ownership/contentAuthorshipPlanner";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "../src/lib/migration/planning/user-ownership/readOnlyRepository";
import { legacyUserIdFromSourceRecordKey, loadClassification, loadContentAuthorshipEvidence } from "../src/lib/migration/planning/user-ownership/snapshotEvidence";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 15: fully read-only re-verification of the Slice 6 content
 * authorship plan for the 12 content-author users, against current DB
 * state (post Slice 7-14 ownership/role writes — none of which touched
 * Article/Route/Activity) and the same immutable snapshot. Reuses
 * `planContentAuthorship` (Slice 6) completely unchanged — no new
 * classification logic, no authorship writes, no role changes.
 */
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

    const classification = loadClassification(args.snapshotRoot);
    const legacyIds = classification.contentAuthor.map(legacyUserIdFromSourceRecordKey);
    const evidence = loadContentAuthorshipEvidence(args.snapshotRoot, legacyIds);
    const entries = await planContentAuthorship(evidence, repository);

    const after = await repository.captureBaselineCounts();
    for (const key of Object.keys(before) as Array<keyof typeof before>) {
      if (before[key] !== after[key]) throw new Error(`BLOCKED_UNEXPECTED_DB_MUTATION:${key}:${before[key]}->${after[key]}`);
    }

    mkdirSync(args.outputDir, { recursive: true });
    writeFileSync(join(args.outputDir, "content-authorship-reconciliation.json"), prettyCanonicalJson(entries));

    const tally: Record<string, number> = {};
    for (const entry of entries) tally[entry.action] = (tally[entry.action] ?? 0) + 1;

    console.log(JSON.stringify({ decision: "SLICE_15_RECONCILIATION_READY", databaseWrites: 0, baselineDelta: 0, userCount: entries.length, tally, entries }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
