import { PrismaClient } from "@prisma/client";

import {
  USER_GOLDEN_KEYS,
  loadUserSourceCandidate,
  maskEmail,
  normalizeUserCandidate,
  planUserMigration,
  writeUserMigration,
} from "../src/lib/migration/commit/user";

type Args = { sourceRecordKey: string; snapshotRoot: string; confirmWrites: boolean };

export function parseUserMigrationArgs(argv: readonly string[]): Args {
  const entityIndex = argv.indexOf("--entity");
  if (entityIndex < 0 || argv[entityIndex + 1] !== "user") throw new Error("Slice 4 requires exactly --entity user.");
  const keyIndexes = argv.flatMap((value, index) => value === "--source-record-key" ? [index] : []);
  if (keyIndexes.length !== 1 || !argv[keyIndexes[0] + 1]) throw new Error("Slice 4 requires exactly one --source-record-key.");
  const sourceRecordKey = argv[keyIndexes[0] + 1];
  if (!USER_GOLDEN_KEYS.includes(sourceRecordKey as (typeof USER_GOLDEN_KEYS)[number])) throw new Error("Source key is outside the approved Slice 4 golden scope.");
  if (argv.includes("--limit") || argv.includes("--all")) throw new Error("Batch execution is forbidden in Slice 4.");
  const rootIndex = argv.indexOf("--snapshot-root");
  return { sourceRecordKey, snapshotRoot: rootIndex >= 0 ? argv[rootIndex + 1] : "/tmp/scratchpad/users", confirmWrites: argv.includes("--confirm-writes") };
}

export function assertLocalDatabaseUrl(raw: string | undefined): void {
  if (!raw) throw new Error("DATABASE_URL is required.");
  const url = new URL(raw);
  if (!(["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "5433" && url.pathname === "/mamago2")) {
    throw new Error("LOCAL_DB_GATE_FAILED: only localhost:5433/mamago2 is allowed.");
  }
}

async function main(): Promise<void> {
  const args = parseUserMigrationArgs(process.argv.slice(2));
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const source = loadUserSourceCandidate(args.snapshotRoot, args.sourceRecordKey);
  const candidate = normalizeUserCandidate(source);
  const prisma = new PrismaClient();
  try {
    const plan = await planUserMigration(prisma, candidate);
    console.log(JSON.stringify({
      mode: args.confirmWrites ? "COMMIT" : "PREVIEW",
      sourceRecordKey: plan.sourceRecordKey,
      legacyUserId: candidate.legacyUserId,
      classification: candidate.classification,
      normalizedEmailMask: maskEmail(candidate.normalizedEmail),
      businessLinkedEvidencePresent: candidate.businessLinked,
      privilegedCollisionEvidencePresent: candidate.privilegedCollision,
      profileMediaReferencePresent: candidate.profileMediaReferencePresent,
      action: plan.action,
      reason: plan.reason,
      warnings: plan.warnings,
      canonicalHash: plan.canonicalHash,
      expectedDeltas: {
        User: plan.action === "CREATE" ? 1 : 0,
        MigrationLineage: plan.action === "CREATE" ? 1 : 0,
        MigrationRecord: args.confirmWrites ? 1 : 0,
        Session: 0,
        UserActionToken: 0,
        Business: 0,
        Place: 0,
        Offer: 0,
        MediaAsset: 0,
      },
    }, null, 2));
    if (!args.confirmWrites) return;
    const result = await writeUserMigration(prisma, plan);
    console.log(JSON.stringify({ committed: true, action: result.action, targetId: result.targetId, recordId: result.recordId }));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("migration-user-vertical-slice.ts")) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
