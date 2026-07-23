import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { buildPlanningManifests, createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository, prettyCanonicalJson } from "../src/lib/migration/planning/user-ownership";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

interface Args {
  snapshotRoot: string;
  outputDir: string;
}

/** Fail-closed: this CLI performs read-only DB access, but it must still never run without the operator explicitly acknowledging that scope by passing `--read-only`. */
function parseArgs(argv: readonly string[]): Args {
  if (!argv.includes("--read-only")) throw new Error("Refusing to run without explicit --read-only.");
  const rootIndex = argv.indexOf("--snapshot-root");
  const outputIndex = argv.indexOf("--output-dir");
  if (rootIndex < 0 || !argv[rootIndex + 1]) throw new Error("USERS Slice 6 planner requires --snapshot-root.");
  if (outputIndex < 0 || !argv[outputIndex + 1]) throw new Error("USERS Slice 6 planner requires --output-dir.");
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
    const manifests = await buildPlanningManifests(args.snapshotRoot, repository);
    const after = await repository.captureBaselineCounts();

    for (const key of Object.keys(before) as Array<keyof typeof before>) {
      if (before[key] !== after[key]) throw new Error(`BLOCKED_UNEXPECTED_DB_MUTATION:${key}:${before[key]}->${after[key]}`);
    }

    mkdirSync(args.outputDir, { recursive: true });
    writeFileSync(join(args.outputDir, "manual-user-backlog.json"), prettyCanonicalJson(manifests.manualBacklog));
    writeFileSync(join(args.outputDir, "business-ownership-plan.json"), prettyCanonicalJson(manifests.businessOwnershipPlan));
    writeFileSync(join(args.outputDir, "content-authorship-plan.json"), prettyCanonicalJson(manifests.contentAuthorshipPlan));

    console.log(
      JSON.stringify(
        {
          decision: "SLICE_6_PLAN_READY",
          databaseWrites: 0,
          baselineDelta: 0,
          summary: manifests.summary,
          hashes: manifests.hashes,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
