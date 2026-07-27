import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  AUTHORSHIP_PROOF_LEGACY_USER_SOURCE_RECORD_KEY,
  buildArticleAuthorshipProof,
  createArticleAuthorshipReadOnlyRepository,
  determineSlice17Decision,
  loadUser575ArticleCandidates,
  selectGoldenArticleCandidate,
} from "../src/lib/migration/planning/article-authorship-proof";
import { prettyCanonicalJson } from "../src/lib/migration/planning/user-ownership/canonicalJson";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "../src/lib/migration/planning/user-ownership/readOnlyRepository";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 17: fully read-only published-Article dependency proof for
 * wordpress-db:user:575's 2 published articles (found in the durable Slice
 * 16 Activity snapshot). Reads the snapshot and current local DB state
 * only — no SSH, no WordPress query, no Article/authorship/User write.
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
    const baselineRepository = createUserOwnershipReadOnlyRepository(readOnlyClient);
    const repository = createArticleAuthorshipReadOnlyRepository(readOnlyClient);

    const before = await baselineRepository.captureBaselineCounts();

    const candidates = loadUser575ArticleCandidates(args.snapshotDir);
    const entries = await buildArticleAuthorshipProof(repository, AUTHORSHIP_PROOF_LEGACY_USER_SOURCE_RECORD_KEY, candidates);

    const after = await baselineRepository.captureBaselineCounts();
    for (const key of Object.keys(before) as Array<keyof typeof before>) {
      if (before[key] !== after[key]) throw new Error(`BLOCKED_UNEXPECTED_DB_MUTATION:${key}:${before[key]}->${after[key]}`);
    }

    const decision = determineSlice17Decision(entries);
    const goldenCandidate = selectGoldenArticleCandidate(entries);

    mkdirSync(args.outputDir, { recursive: true });
    writeFileSync(join(args.outputDir, "article-authorship-proof.json"), prettyCanonicalJson(entries));

    console.log(
      JSON.stringify(
        {
          decision,
          databaseWrites: 0,
          baselineDelta: 0,
          totalEntries: entries.length,
          entries: entries.map(entry => ({ sourceRecordKey: entry.sourceRecordKey, classification: entry.classification, reasonCode: entry.reasonCode })),
          goldenCandidateSourceRecordKey: goldenCandidate?.sourceRecordKey ?? null,
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
