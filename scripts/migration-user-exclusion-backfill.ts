/**
 * Issue #1064: explicitly reviewed, additive-only recovery of WordPress
 * users excluded from the first Phoenix release.
 *
 * PREVIEW is the default operational path. COMMIT requires an exact reviewed
 * manifest, its SHA-256, separate production confirmations, and evidence that
 * a restorable PROD backup was verified. No email is sent by this script.
 * Run on the operator's Mac (which can read live WordPress), never on PROD.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import { WordPressRepository } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import {
  LIVE_USER_SOURCE_NAMESPACE,
  readFounderExclusionKeys,
  userSourceCandidateFromWordPressRow,
} from "../src/lib/migration/commit/user/liveWordPressUserSource";
import {
  maskEmail,
  normalizeUserCandidate,
  planUserMigration,
  writeUserMigration,
} from "../src/lib/migration/commit/user/UserMigrationVerticalSlice";
import {
  assertBackfillPlanMatchesApproval,
  hashBackfillEmail,
  parseApprovedUserBackfillManifest,
  type ApprovedUserBackfillEntry,
} from "../src/lib/migration/commit/user/productionExclusionBackfillPolicy";
import { USERS_UNRESOLVED_SOURCE_RECORD_KEYS } from "../src/lib/migration/release/knownBlockers";
import { assertMigrationDatabaseTarget } from "../src/lib/migration/runtime/migrationDatabaseTarget";

interface Args {
  mode: "PREVIEW" | "COMMIT";
  confirmProduction: boolean;
  acknowledgeProdUserImport: boolean;
  acknowledgeExclusionBackfill: boolean;
  confirmBackupRestored: boolean;
  backupReference: string | null;
  allowRemoteReadonly: boolean;
  manifestPath: string | null;
  reviewedManifestHash: string | null;
}

function flagValue(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error("Missing value for " + name);
  return argv[index + 1];
}

export function parseUserExclusionBackfillArgs(argv: readonly string[]): Args {
  const preview = argv.includes("--preview");
  const commit = argv.includes("--confirm-writes");
  if (preview === commit) throw new Error("Choose exactly one of --preview and --confirm-writes.");
  const args: Args = {
    mode: preview ? "PREVIEW" : "COMMIT",
    confirmProduction: argv.includes("--confirm-production"),
    acknowledgeProdUserImport: argv.includes("--acknowledge-prod-user-import"),
    acknowledgeExclusionBackfill: argv.includes("--acknowledge-exclusion-backfill"),
    confirmBackupRestored: argv.includes("--confirm-backup-restored"),
    backupReference: flagValue(argv, "--backup-reference"),
    allowRemoteReadonly: argv.includes("--allow-remote-readonly"),
    manifestPath: flagValue(argv, "--manifest"),
    reviewedManifestHash: flagValue(argv, "--reviewed-manifest-sha256"),
  };
  const knownFlags = new Set([
    "--preview", "--confirm-writes", "--confirm-production",
    "--acknowledge-prod-user-import", "--acknowledge-exclusion-backfill",
    "--confirm-backup-restored", "--allow-remote-readonly",
  ]);
  const valueFlags = new Set(["--backup-reference", "--manifest", "--reviewed-manifest-sha256"]);
  for (let i = 0; i < argv.length; i++) {
    if (valueFlags.has(argv[i])) { i += 1; continue; }
    if (!knownFlags.has(argv[i])) throw new Error("Unknown argument: " + argv[i]);
  }
  if (commit && (
    !args.confirmProduction || !args.acknowledgeProdUserImport ||
    !args.acknowledgeExclusionBackfill || !args.confirmBackupRestored ||
    !args.backupReference || !args.manifestPath || !args.reviewedManifestHash ||
    !/^[a-f0-9]{64}$/.test(args.reviewedManifestHash)
  )) throw new Error("PROD_BACKFILL_APPROVAL_AND_BACKUP_REQUIRED");
  return args;
}

interface PlannedRow {
  sourceRecordKey: string;
  action: string;
  reason: string | null;
  emailMask: string | null;
  emailSha256: string | null;
  canonicalHash: string;
  sourceHash: string;
}

async function assertNoOtherUserSourceOrEmailCollision(
  prisma: PrismaClient,
  plan: Awaited<ReturnType<typeof planUserMigration>>,
): Promise<void> {
  const lineageRows = await prisma.migrationLineage.findMany({
    where: { targetType: "USER", sourceRecordKey: plan.sourceRecordKey, isActive: true },
    select: { targetId: true, source: { select: { sourceNamespace: true } } },
  });
  const allowedSkip = plan.action === "SKIP_UNCHANGED" &&
    plan.targetId !== null &&
    lineageRows.length === 1 &&
    lineageRows[0].source.sourceNamespace === LIVE_USER_SOURCE_NAMESPACE &&
    lineageRows[0].targetId === plan.targetId;
  if (lineageRows.length && !allowedSkip) {
    throw new Error("BACKFILL_SOURCE_LINEAGE_COLLISION:" + plan.sourceRecordKey);
  }
  const normalizedEmail = plan.candidate.normalizedEmail;
  if (!normalizedEmail) throw new Error("BACKFILL_EMAIL_INVALID:" + plan.sourceRecordKey);
  // Case-folded comparison is intentionally stricter than User.email @unique.
  const matches = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE lower(btrim("email")) = ${normalizedEmail} LIMIT 2
  `;
  if (plan.action === "CREATE" && matches.length !== 0) {
    throw new Error("BACKFILL_EMAIL_COLLISION:" + plan.sourceRecordKey);
  }
  if (plan.action === "SKIP_UNCHANGED" &&
      (matches.length !== 1 || matches[0].id !== plan.targetId)) {
    throw new Error("BACKFILL_IDEMPOTENCY_TARGET_MISMATCH:" + plan.sourceRecordKey);
  }
}

async function main(): Promise<void> {
  const args = parseUserExclusionBackfillArgs(process.argv.slice(2));
  const wpConfig = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(wpConfig, args.allowRemoteReadonly);

  const prisma = new PrismaClient();
  try {
    const db = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    assertMigrationDatabaseTarget({
      databaseUrl: process.env.DATABASE_URL,
      currentDatabase: db[0]?.current_database,
      confirmProduction: args.confirmProduction,
      confirmWrites: args.mode === "COMMIT",
      acknowledgeProdUserImport: args.acknowledgeProdUserImport,
      requireProdUserAcknowledgement: true,
    });

    const exclusions = readFounderExclusionKeys();
    const allowed = new Set<string>(USERS_UNRESOLVED_SOURCE_RECORD_KEYS);
    if (exclusions.size !== allowed.size ||
        [...allowed].some(key => !exclusions.has(key))) {
      throw new Error("FOUNDER_EXCLUSION_POLICY_CHANGED");
    }

    let manifestEntries: ApprovedUserBackfillEntry[] | null = null;
    if (args.manifestPath) {
      const bytes = readFileSync(args.manifestPath);
      if (args.mode === "COMMIT") {
        const actualHash = createHash("sha256").update(bytes).digest("hex");
        if (actualHash !== args.reviewedManifestHash) {
          throw new Error("BACKFILL_REVIEWED_MANIFEST_HASH_MISMATCH");
        }
      }
      manifestEntries = parseApprovedUserBackfillManifest(JSON.parse(bytes.toString("utf8"))).entries;
    }

    const rows = await new WordPressRepository(
      createWordPressSshMysqlExecutor(wpConfig),
    ).getUsers(20000);
    const byId = new Map(rows.map(row => [row.ID, row]));
    if (byId.size !== rows.length) throw new Error("BACKFILL_DUPLICATE_WORDPRESS_IDS");
    const snapshotHash = createHash("sha256")
      .update(JSON.stringify(rows.map(row => row.ID))).digest("hex");
    const keys = manifestEntries
      ? manifestEntries.map(entry => entry.sourceRecordKey)
      : [...allowed].sort();

    const plans = [];
    const report: PlannedRow[] = [];
    for (const key of keys) {
      const legacyId = Number(key.slice("wordpress-db:user:".length));
      const row = byId.get(legacyId);
      if (!row) throw new Error("BACKFILL_SOURCE_MISSING:" + key);
      const source = userSourceCandidateFromWordPressRow(row, { excludedKeys: exclusions });
      if (source.sourceRecordKey !== key) throw new Error("BACKFILL_SOURCE_KEY_MISMATCH:" + key);
      const candidate = normalizeUserCandidate(source);
      const plan = await planUserMigration(prisma, candidate, LIVE_USER_SOURCE_NAMESPACE);
      const approved = manifestEntries?.find(entry => entry.sourceRecordKey === key);
      const diagnostics = {
        sourceRecordKey: key,
        action: plan.action,
        reason: plan.reason,
        emailMask: maskEmail(candidate.normalizedEmail),
        emailSha256: candidate.normalizedEmail ? hashBackfillEmail(candidate.normalizedEmail) : null,
        canonicalHash: plan.canonicalHash,
        sourceHash: source.sourceHash,
      };
      report.push(diagnostics);
      if (approved) {
        assertBackfillPlanMatchesApproval(approved, plan, source.sourceHash);
        await assertNoOtherUserSourceOrEmailCollision(prisma, plan);
      }
      plans.push({ source, candidate, plan, approved });
    }
    console.log(JSON.stringify({ mode: args.mode, target: db[0]?.current_database, report }, null, 2));

    if (args.mode !== "COMMIT") {
      console.log("PREVIEW ONLY: zero DB writes and zero emails");
      return;
    }
    if (!manifestEntries?.length || plans.some(item => !item.approved)) {
      throw new Error("BACKFILL_NO_APPROVED_SCOPE");
    }
    const initial = {
      users: await prisma.user.count(),
      businesses: await prisma.business.count(),
      members: await prisma.businessMember.count(),
    };
    let created = 0;
    let skipped = 0;
    for (const item of plans) {
      // Re-check immediately before writing to avoid stale preflight plans.
      const current = await planUserMigration(prisma, item.candidate, LIVE_USER_SOURCE_NAMESPACE);
      assertBackfillPlanMatchesApproval(item.approved!, current, item.source.sourceHash);
      await assertNoOtherUserSourceOrEmailCollision(prisma, current);
      if (current.action === "SKIP_UNCHANGED") {
        skipped += 1;
        continue; // No write at all, including to the ledger.
      }
      if (current.action !== "CREATE") throw new Error("BACKFILL_NON_CREATE_BLOCKED");
      const result = await writeUserMigration(prisma, current, LIVE_USER_SOURCE_NAMESPACE, { snapshotHash });
      if (result.action !== "CREATE") throw new Error("BACKFILL_UNEXPECTED_WRITE_ACTION");
      created += 1;
      console.log(JSON.stringify({ sourceRecordKey: current.sourceRecordKey, result: "CREATED" }));
    }
    const final = {
      users: await prisma.user.count(),
      businesses: await prisma.business.count(),
      members: await prisma.businessMember.count(),
    };
    if (final.users !== initial.users + created ||
        final.businesses !== initial.businesses ||
        final.members !== initial.members) {
      throw new Error("BACKFILL_POST_WRITE_COUNT_MISMATCH: manual audit required");
    }
    console.log(JSON.stringify({
      complete: true, created, skipped,
      before: initial, after: final, emailsSent: 0,
      businessWrites: 0, roleElevations: 0, existingUserWrites: 0,
      backupReference: args.backupReference,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("migration-user-exclusion-backfill.ts")) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
