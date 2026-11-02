/**
 * Issue #1064: targeted recovery of the single historical WordPress User 43,
 * using the existing migrated DEV user+lineage as evidence because the original
 * WordPress database is no longer available.
 *
 * This is NOT a DEV->PROD database synchronization. All other Users and every
 * Business/BusinessMember/role/credential/session are out of scope.
 *
 * PREVIEW: read-only on DEV and PROD.
 * COMMIT: one new PROD User (USER/PENDING_ACTIVATION/passwordHash=null), with
 * auditable lineage via the proven serializable migration writer. No mail.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  maskEmail,
  normalizeUserCandidate,
  normalizeUserEmail,
  planUserMigration,
  writeUserMigration,
  type UserSourceCandidate,
} from "../src/lib/migration/commit/user/UserMigrationVerticalSlice";
import {
  readFounderExclusionKeys,
} from "../src/lib/migration/commit/user/liveWordPressUserSource";
import {
  assertBackfillPlanMatchesApproval,
  hashBackfillEmail,
  parseApprovedUserBackfillManifest,
  type ApprovedUserBackfillEntry,
} from "../src/lib/migration/commit/user/productionExclusionBackfillPolicy";
import {
  assertMigrationDatabaseTarget,
  parseMigrationDatabaseUrl,
  DEV_DATABASE_NAME,
} from "../src/lib/migration/runtime/migrationDatabaseTarget";

const SOURCE_KEY = "wordpress-db:user:43" as const;
const SOURCE_NAMESPACE = "dev-user-recovery-1064";

interface Args {
  mode: "PREVIEW" | "COMMIT";
  confirmProduction: boolean;
  acknowledgeProdUserImport: boolean;
  acknowledgeExclusionBackfill: boolean;
  confirmBackupRestored: boolean;
  backupReference: string | null;
  manifestPath: string | null;
  reviewedManifestHash: string | null;
}

function flagValue(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  if (!argv[index + 1] || argv[index + 1].startsWith("--")) {
    throw new Error("Missing value for " + name);
  }
  return argv[index + 1];
}

export function parseUserExclusionBackfillArgs(argv: readonly string[]): Args {
  const preview = argv.includes("--preview");
  const commit = argv.includes("--confirm-writes");
  if (preview === commit) {
    throw new Error("Choose exactly one of --preview and --confirm-writes.");
  }
  const args: Args = {
    mode: preview ? "PREVIEW" : "COMMIT",
    confirmProduction: argv.includes("--confirm-production"),
    acknowledgeProdUserImport: argv.includes("--acknowledge-prod-user-import"),
    acknowledgeExclusionBackfill: argv.includes("--acknowledge-exclusion-backfill"),
    confirmBackupRestored: argv.includes("--confirm-backup-restored"),
    backupReference: flagValue(argv, "--backup-reference"),
    manifestPath: flagValue(argv, "--manifest"),
    reviewedManifestHash: flagValue(argv, "--reviewed-manifest-sha256"),
  };
  const knownFlags = new Set([
    "--preview", "--confirm-writes", "--confirm-production",
    "--acknowledge-prod-user-import", "--acknowledge-exclusion-backfill",
    "--confirm-backup-restored",
  ]);
  const valueFlags = new Set([
    "--backup-reference", "--manifest", "--reviewed-manifest-sha256",
  ]);
  for (let i = 0; i < argv.length; i++) {
    if (valueFlags.has(argv[i])) { i += 1; continue; }
    if (!knownFlags.has(argv[i])) throw new Error("Unknown argument: " + argv[i]);
  }
  if (!args.confirmProduction) throw new Error("PROD_TARGET_CONFIRMATION_REQUIRED");
  if (commit && (
    !args.acknowledgeProdUserImport ||
    !args.acknowledgeExclusionBackfill || !args.confirmBackupRestored ||
    !args.backupReference || !args.manifestPath || !args.reviewedManifestHash ||
    !/^[a-f0-9]{64}$/.test(args.reviewedManifestHash)
  )) throw new Error("PROD_BACKFILL_APPROVAL_AND_BACKUP_REQUIRED");
  return args;
}

async function readMigratedDevSource(dev: PrismaClient): Promise<UserSourceCandidate> {
  // Exactly one original USER lineage is required; no synthetic DEV account,
  // deleted user, privileged account or alternate source can be used.
  const lineages = await dev.migrationLineage.findMany({
    where: { sourceRecordKey: SOURCE_KEY, targetType: "USER", isActive: true },
    select: {
      targetId: true, lastSourceHash: true,
      source: { select: { adapterKey: true, sourceNamespace: true } },
    },
  });
  if (lineages.length !== 1 ||
      !lineages[0].targetId ||
      !lineages[0].lastSourceHash ||
      lineages[0].source.adapterKey !== "wordpress-db" ||
      lineages[0].source.sourceNamespace !== "users-immutable-snapshot") {
    throw new Error("DEV_SOURCE_LINEAGE_NOT_VERIFIED:" + SOURCE_KEY);
  }
  const user = await dev.user.findUnique({
    where: { id: lineages[0].targetId },
    select: { id: true, email: true, displayName: true, status: true, deletedAt: true, role: true },
  });
  if (!user || user.deletedAt ||
      user.status !== "PENDING_ACTIVATION" ||
      user.role !== "BUSINESS_OWNER" ||
      !normalizeUserEmail(user.email)) {
    throw new Error("DEV_SOURCE_USER_NOT_ELIGIBLE:" + SOURCE_KEY);
  }
  const email = normalizeUserEmail(user.email)!;
  // This captures provenance and changes in DEV identity. No DEV password,
  // User.id, Business relationship or other private record is ever imported.
  const sourceHash = createHash("sha256").update(JSON.stringify({
    key: SOURCE_KEY, devUserId: user.id, legacyLineageHash: lineages[0].lastSourceHash,
    email, displayName: user.displayName, status: user.status,
  })).digest("hex");
  return {
    sourceRecordKey: SOURCE_KEY,
    sourceSystem: "wordpress-db",
    legacyUserId: 43,
    email,
    displayName: user.displayName,
    firstName: null,
    lastName: null,
    phone: null,
    sourceCreatedAt: null,
    legacyRoles: [],
    legacyPasswordPresent: false,
    businessLinked: false,
    businessEvidence: { exactOwnership: false, placeCount: 0 },
    privilegedCollision: false,
    profileMediaReferencePresent: false,
    sourceHash,
  };
}

async function assertNoOtherUserSourceOrEmailCollision(
  prod: PrismaClient,
  plan: Awaited<ReturnType<typeof planUserMigration>>,
): Promise<void> {
  const lineageRows = await prod.migrationLineage.findMany({
    where: { targetType: "USER", sourceRecordKey: plan.sourceRecordKey, isActive: true },
    select: { targetId: true, source: { select: { sourceNamespace: true } } },
  });
  const allowedSkip = plan.action === "SKIP_UNCHANGED" &&
    plan.targetId !== null && lineageRows.length === 1 &&
    lineageRows[0].source.sourceNamespace === SOURCE_NAMESPACE &&
    lineageRows[0].targetId === plan.targetId;
  if (lineageRows.length && !allowedSkip) {
    throw new Error("BACKFILL_SOURCE_LINEAGE_COLLISION:" + plan.sourceRecordKey);
  }
  const email = plan.candidate.normalizedEmail;
  if (!email) throw new Error("BACKFILL_EMAIL_INVALID:" + plan.sourceRecordKey);
  // Stronger than User.email's case-sensitive unique constraint.
  const matches = await prod.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE lower(btrim("email")) = ${email} LIMIT 2
  `;
  if (plan.action === "CREATE" && matches.length) {
    throw new Error("BACKFILL_EMAIL_COLLISION:" + plan.sourceRecordKey);
  }
  if (plan.action === "SKIP_UNCHANGED" &&
      (matches.length !== 1 || matches[0].id !== plan.targetId)) {
    throw new Error("BACKFILL_IDEMPOTENCY_TARGET_MISMATCH:" + plan.sourceRecordKey);
  }
}

async function main(): Promise<void> {
  const args = parseUserExclusionBackfillArgs(process.argv.slice(2));
  const sourceUrl = process.env.SOURCE_DEV_DATABASE_URL;
  const prodUrl = process.env.DATABASE_URL;
  if (!sourceUrl || !prodUrl) {
    throw new Error("Missing required env vars: SOURCE_DEV_DATABASE_URL, DATABASE_URL. "
      + "Use secure local SSH tunnels; do not paste credentials into chat.");
  }
  const parsedDev = parseMigrationDatabaseUrl(sourceUrl);
  if (parsedDev.database !== DEV_DATABASE_NAME) {
    throw new Error("SOURCE_DATABASE_MUST_BE_DEVMAMAGO");
  }
  const founderExclusions = readFounderExclusionKeys();
  if (!founderExclusions.has(SOURCE_KEY)) {
    throw new Error("HISTORICAL_EXCLUSION_POLICY_CHANGED");
  }
  const dev = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const prod = new PrismaClient();
  try {
    const [devDb, prodDb] = await Promise.all([
      dev.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`,
      prod.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`,
    ]);
    if (devDb[0]?.current_database !== DEV_DATABASE_NAME) {
      throw new Error("DEV_DATABASE_FINGERPRINT_MISMATCH");
    }
    assertMigrationDatabaseTarget({
      databaseUrl: prodUrl,
      currentDatabase: prodDb[0]?.current_database,
      confirmProduction: args.confirmProduction,
      confirmWrites: args.mode === "COMMIT",
      acknowledgeProdUserImport: args.acknowledgeProdUserImport,
      requireProdUserAcknowledgement: true,
    });

    const source = await readMigratedDevSource(dev);
    const candidate = normalizeUserCandidate(source);
    const plan = await planUserMigration(prod, candidate, SOURCE_NAMESPACE);
    await assertNoOtherUserSourceOrEmailCollision(prod, plan);

    let approval: ApprovedUserBackfillEntry | null = null;
    if (args.manifestPath) {
      const bytes = readFileSync(args.manifestPath);
      if (args.mode === "COMMIT" &&
          createHash("sha256").update(bytes).digest("hex") !== args.reviewedManifestHash) {
        throw new Error("BACKFILL_REVIEWED_MANIFEST_HASH_MISMATCH");
      }
      const manifest = parseApprovedUserBackfillManifest(JSON.parse(bytes.toString("utf8")));
      if (manifest.entries.length !== 1 || manifest.entries[0].sourceRecordKey !== SOURCE_KEY) {
        throw new Error("BACKFILL_SCOPE_NOT_SINGLE_USER_43");
      }
      approval = manifest.entries[0];
      assertBackfillPlanMatchesApproval(approval, plan, source.sourceHash);
    }
    console.log(JSON.stringify({
      mode: args.mode,
      sourceDatabase: DEV_DATABASE_NAME,
      targetDatabase: prodDb[0]?.current_database,
      sourceRecordKey: SOURCE_KEY,
      action: plan.action,
      reason: plan.reason,
      emailMask: maskEmail(candidate.normalizedEmail),
      emailSha256: candidate.normalizedEmail ? hashBackfillEmail(candidate.normalizedEmail) : null,
      canonicalHash: plan.canonicalHash,
      sourceHash: source.sourceHash,
      targetRole: "USER",
      targetStatus: "PENDING_ACTIVATION",
      transfersBusiness: false,
      transfersPassword: false,
    }, null, 2));

    if (args.mode === "PREVIEW") {
      console.log("PREVIEW ONLY: zero writes, zero emails");
      return;
    }
    if (!approval) throw new Error("BACKFILL_NO_APPROVED_MANIFEST");

    const initial = {
      users: await prod.user.count(),
      businesses: await prod.business.count(),
      members: await prod.businessMember.count(),
    };

    // Re-read both sides immediately before writing, including DEV identity.
    const currentSource = await readMigratedDevSource(dev);
    const currentCandidate = normalizeUserCandidate(currentSource);
    const current = await planUserMigration(prod, currentCandidate, SOURCE_NAMESPACE);
    assertBackfillPlanMatchesApproval(approval, current, currentSource.sourceHash);
    await assertNoOtherUserSourceOrEmailCollision(prod, current);
    if (current.action !== "CREATE" && current.action !== "SKIP_UNCHANGED") {
      throw new Error("BACKFILL_NON_CREATE_BLOCKED");
    }
    if (current.action === "CREATE") {
      const written = await writeUserMigration(prod, current, SOURCE_NAMESPACE, {
        snapshotHash: currentSource.sourceHash,
      });
      if (written.action !== "CREATE") throw new Error("BACKFILL_UNEXPECTED_WRITE_ACTION");
    }
    const created = Number(current.action === "CREATE");
    const final = {
      users: await prod.user.count(),
      businesses: await prod.business.count(),
      members: await prod.businessMember.count(),
    };
    if (final.users !== initial.users + created ||
        final.businesses !== initial.businesses ||
        final.members !== initial.members) {
      throw new Error("BACKFILL_POST_WRITE_COUNT_MISMATCH: manual audit required");
    }
    console.log(JSON.stringify({
      complete: true, created, skipped: 1 - created,
      before: initial, after: final, emailsSent: 0,
      businessWrites: 0, roleElevations: 0, existingUserWrites: 0,
      backupReference: args.backupReference,
    }));
  } finally {
    await Promise.all([dev.$disconnect(), prod.$disconnect()]);
  }
}

if (process.argv[1]?.endsWith("migration-user-exclusion-backfill.ts")) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
