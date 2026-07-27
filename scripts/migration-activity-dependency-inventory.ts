import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { classifyActivityDependencies, loadActivitySnapshot } from "../src/lib/migration/planning/activity-dependency-inventory";
import { prettyCanonicalJson } from "../src/lib/migration/planning/user-ownership/canonicalJson";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "../src/lib/migration/planning/user-ownership/readOnlyRepository";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 16: fully read-only classification of the standalone
 * Activity snapshot (captured separately, outside this repo and outside
 * /tmp) against current local DB state. Zero Activity/authorship/User-
 * role/media writes — this script only reads.
 */
interface Args {
  snapshotDir: string;
  outputDir: string;
}

function parseArgs(argv: readonly string[]): Args {
  if (!argv.includes("--read-only")) throw new Error("Refusing to run without explicit --read-only.");
  const snapshotIndex = argv.indexOf("--snapshot-dir");
  const outputIndex = argv.indexOf("--output-dir");
  if (snapshotIndex < 0 || !argv[snapshotIndex + 1]) throw new Error("Requires --snapshot-dir.");
  if (outputIndex < 0 || !argv[outputIndex + 1]) throw new Error("Requires --output-dir.");
  return { snapshotDir: argv[snapshotIndex + 1], outputDir: argv[outputIndex + 1] };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertLocalDatabaseUrl(process.env.DATABASE_URL);

  const prisma = new PrismaClient();
  try {
    const readOnlyClient = createReadOnlyPrismaClient(prisma);
    const repository = createUserOwnershipReadOnlyRepository(readOnlyClient);

    const before = await repository.captureBaselineCounts();

    const { posts, postmeta, manifest: snapshotManifest } = loadActivitySnapshot(args.snapshotDir);

    const authorIds = [...new Set(posts.map(post => post.post_author))];
    const userLineageMap = new Map<number, boolean>();
    for (const authorId of authorIds) {
      const lineage = await readOnlyClient.migrationLineage.findFirst({ where: { targetType: "USER", sourceRecordKey: `wordpress-db:user:${authorId}`, isActive: true }, select: { id: true } });
      userLineageMap.set(authorId, Boolean(lineage));
    }

    const activityLineageKeys = await readOnlyClient.migrationLineage.findMany({ where: { targetType: "ACTIVITY", isActive: true }, select: { sourceRecordKey: true } });
    const articleLineageKeys = await readOnlyClient.migrationLineage.findMany({ where: { targetType: "ARTICLE", isActive: true }, select: { sourceRecordKey: true } });
    const alreadyMigratedKeys = new Set([...activityLineageKeys, ...articleLineageKeys].map(row => row.sourceRecordKey));

    const entries = classifyActivityDependencies(posts, postmeta, alreadyMigratedKeys, userLineageMap);

    const after = await repository.captureBaselineCounts();
    for (const key of Object.keys(before) as Array<keyof typeof before>) {
      if (before[key] !== after[key]) throw new Error(`BLOCKED_UNEXPECTED_DB_MUTATION:${key}:${before[key]}->${after[key]}`);
    }

    const tally: Record<string, number> = {};
    for (const entry of entries) tally[entry.verdict] = (tally[entry.verdict] ?? 0) + 1;

    const createCandidates = entries.filter(entry => entry.verdict === "CREATE");
    const goldenCandidate = createCandidates.length > 0 ? createCandidates[0] : null;

    mkdirSync(args.outputDir, { recursive: true });
    writeFileSync(join(args.outputDir, "activity-dependency-inventory.json"), prettyCanonicalJson(entries));

    console.log(
      JSON.stringify(
        {
          decision: "SLICE_16_INVENTORY_READY",
          databaseWrites: 0,
          baselineDelta: 0,
          totalEntries: entries.length,
          tally,
          fullActivityInventoryStatusBreakdown: snapshotManifest.fullActivityInventory.eventStatusBreakdown,
          goldenCandidateSourceRecordKey: goldenCandidate?.sourceRecordKey ?? null,
          goldenCandidateNote: goldenCandidate ? null : "No CREATE-eligible entry exists among the 10 TARGET_NOT_MIGRATED users under the current publish-only Activity policy.",
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
