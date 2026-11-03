/**
 * #1064 — founder-approved five-user WordPress archival recovery.
 * Operator-only. This command cannot send emails or alter Business/Activity.
 * All five User CREATE operations are in ONE SERIALIZABLE transaction.
 */
import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildUserDraft, buildUserCanonicalHash, maskEmail, normalizeUserCandidate,
  normalizeUserEmail, type NormalizedUserCandidate, type UserCreateDraft,
} from "../src/lib/migration/commit/user/UserMigrationVerticalSlice";
import {
  FIVE_RECOVERY_KEYS, FIVE_RECOVERY_NAMESPACE,
  type FiveRecoveryApproval,
  assertFiveRecoveryPlanApproved, parseFiveRecoveryArgs,
  verifyFiveRecoveryManifestBytes,
} from "../src/lib/migration/commit/user/wordpressFiveArchiveBackfillPolicy";
import { readFounderExclusionKeys } from "../src/lib/migration/commit/user/liveWordPressUserSource";
import {
  assertMigrationDatabaseTarget, parseMigrationDatabaseUrl, DEV_DATABASE_NAME,
} from "../src/lib/migration/runtime/migrationDatabaseTarget";
import {
  FIVE_WORDPRESS_SOURCE_KEYS, SOURCE_NAMESPACE,
  checkDevUser43, readInputFromStdin, sourceCandidate,
} from "./migration-wordpress-five-preview";

export interface Planned {
  sourceRecordKey: string;
  email: string;
  canonicalHash: string;
  sourceHash: string;
  candidate: NormalizedUserCandidate;
  draft: UserCreateDraft;
}

export async function commitApprovedFiveAtomic(
  prod: PrismaClient,
  planned: Planned[],
  approval: FiveRecoveryApproval,
  archiveSha256: string,
  manifestSha256: string,
) {
    const result = await prod.$transaction(async tx => {
      const locks = await tx.$queryRawUnsafe<Array<{ acquired: boolean }>>(
        "SELECT pg_try_advisory_xact_lock(1064, 5) AS acquired",
      );
      if (!locks[0]?.acquired) {
        throw new Error("FIVE_RECOVERY_CONCURRENT_IMPORT_REFUSED");
      }
      const lineages = await tx.migrationLineage.findMany({
        where: {
          sourceRecordKey: { in: [...FIVE_RECOVERY_KEYS] },
          targetType: "USER",
        },
        select: {
          sourceRecordKey: true, targetId: true, lastSourceHash: true,
          isActive: true,
          source: { select: { adapterKey: true, sourceNamespace: true } },
        },
      });
      const bySource = new Map<string, typeof lineages>();
      for (const lineage of lineages) {
        const existing = bySource.get(lineage.sourceRecordKey) ?? [];
        existing.push(lineage);
        bySource.set(lineage.sourceRecordKey, existing);
      }

      const toCreate: Planned[] = [];
      const toSkip: Planned[] = [];
      for (let i = 0; i < planned.length; i++) {
        const plan = planned[i];
        const matching = bySource.get(plan.sourceRecordKey) ?? [];
        if (matching.length > 1) {
          throw new Error("FIVE_RECOVERY_MULTIPLE_LINEAGE_COLLISION");
        }
        const emails = await tx.$queryRawUnsafe<Array<{
          id: string; email: string; role: string;
        }>>(
          'SELECT "id", "email", "role"::text AS "role" ' +
          'FROM "User" WHERE lower(btrim("email")) = $1 LIMIT 2',
          plan.email,
        );
        if (matching.length === 0 && emails.length === 0) {
          toCreate.push(plan);
        } else if (
          matching.length === 1 && emails.length === 1 &&
          matching[0].source.adapterKey === "wordpress-db" &&
          matching[0].source.sourceNamespace === FIVE_RECOVERY_NAMESPACE &&
          matching[0].isActive &&
          matching[0].targetId === emails[0].id &&
          matching[0].lastSourceHash === plan.canonicalHash &&
          normalizeUserEmail(emails[0].email) === plan.email &&
          emails[0].role === "USER"
        ) {
          // Safe on reruns, including users who activated after import.
          assertFiveRecoveryPlanApproved(approval.entries[i], {
            ...plan, action: "SKIP_UNCHANGED",
          }, plan.sourceHash);
          toSkip.push(plan);
        } else {
          throw new Error("FIVE_RECOVERY_SOURCE_OR_EMAIL_COLLISION:" + plan.sourceRecordKey);
        }
      }
      // No mixed partial imports: requires operator investigation.
      if (toCreate.length > 0 && toSkip.length > 0) {
        throw new Error("FIVE_RECOVERY_PARTIAL_PREVIOUS_IMPORT_REQUIRES_REVIEW");
      }
      const before = {
        users: await tx.user.count(),
        businesses: await tx.business.count(),
        members: await tx.businessMember.count(),
        activities: await tx.activity.count(),
      };
      if (toCreate.length === 0) {
        return { created: 0, skipped: 5, before, after: before };
      }
      if (toCreate.length !== 5) {
        throw new Error("FIVE_RECOVERY_NOT_FULL_FIVE_SCOPE");
      }
      const source = await tx.migrationSource.upsert({
        where: {
          adapterKey_sourceNamespace: {
            adapterKey: "wordpress-db",
            sourceNamespace: FIVE_RECOVERY_NAMESPACE,
          },
        },
        create: {
          adapterKey: "wordpress-db",
          sourceNamespace: FIVE_RECOVERY_NAMESPACE,
          name: "WordPress archival recovery: five founder-approved User identities",
          scope: {
            issue: 1064, identityOnly: true, sourceDate: "2026-07-03",
            businessOwnershipImported: false,
          },
        },
        update: {},
      });
      const run = await tx.migrationRun.create({
        data: {
          sourceId: source.id, mode: "COMMIT", status: "RUNNING",
          adapterVersion: "users-archive-five-v1",
          snapshotHash: archiveSha256, startedAt: new Date(),
        },
      });
      for (const plan of toCreate) {
        const record = await tx.migrationRecord.create({
          data: {
            sourceId: source.id, runId: run.id, status: "PLANNED",
            sourceEntityType: "wordpress-db:user",
            sourceExternalId: String(plan.candidate.legacyUserId),
            sourceStableKey: plan.sourceRecordKey,
            sourceRecordKey: plan.sourceRecordKey,
            sourceHash: plan.canonicalHash, rawPayload: Prisma.JsonNull,
            normalizedPayload: {
              sourceRecordKey: plan.sourceRecordKey,
              legacyUserId: plan.candidate.legacyUserId,
              emailMask: maskEmail(plan.email),
              archiveSha256: archiveSha256,
              role: "USER", status: "PENDING_ACTIVATION",
              passwordImported: false,
              businessImported: false, eventsImported: false,
              activationEmailSent: false,
            },
            targetTypeHint: "USER", planAction: "CREATE",
            planSummary: {
              action: "CREATE", canonicalHash: plan.canonicalHash,
              sourceHash: plan.sourceHash, issue: 1064,
            },
            validationSummary: {
              manifestSha256: manifestSha256,
              archivedIdentityMatched: true,
            },
          },
        });
        const user = await tx.user.create({
          data: {
            email: plan.email, displayName: plan.draft.displayName,
            role: "USER", status: "PENDING_ACTIVATION",
            passwordHash: null, emailVerifiedAt: null,
            phoneE164: null, deletedAt: null,
          },
        });
        await tx.migrationLineage.create({
          data: {
            sourceId: source.id, recordId: record.id, runId: run.id,
            sourceEntityType: "wordpress-db:user",
            sourceExternalId: String(plan.candidate.legacyUserId),
            sourceStableKey: plan.sourceRecordKey,
            sourceRecordKey: plan.sourceRecordKey,
            targetType: "USER", targetId: user.id,
            targetRole: "primary", targetNaturalKey: maskEmail(plan.email),
            lastSourceHash: plan.canonicalHash,
            lastPlanAction: "CREATE", isActive: true,
            lastSeenAt: new Date(), lastImportedAt: new Date(),
          },
        });
        await tx.migrationRecord.update({
          where: { id: record.id }, data: { status: "LINKED" },
        });
      }
      await tx.migrationRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED", finishedAt: new Date(),
          counters: { CREATE: 5 },
        },
      });
      const after = {
        users: await tx.user.count(),
        businesses: await tx.business.count(),
        members: await tx.businessMember.count(),
        activities: await tx.activity.count(),
      };
      if (after.users !== before.users + 5 ||
          after.businesses !== before.businesses ||
          after.members !== before.members ||
          after.activities !== before.activities) {
        throw new Error("FIVE_RECOVERY_POST_WRITE_COUNTS_MISMATCH");
      }
      return { created: 5, skipped: 0, before, after };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 15000, timeout: 30000,
    });
    return result;
}

async function main(): Promise<void> {
  // Do not consume private archive data or connect to PROD before the full gate.
  const args = parseFiveRecoveryArgs(process.argv.slice(2));
  const approval = verifyFiveRecoveryManifestBytes(
    readFileSync(args.approvedManifest), args.approvedManifestSha256,
  );
  if (SOURCE_NAMESPACE !== FIVE_RECOVERY_NAMESPACE ||
      JSON.stringify(FIVE_WORDPRESS_SOURCE_KEYS) !== JSON.stringify(FIVE_RECOVERY_KEYS)) {
    throw new Error("FIVE_RECOVERY_PREVIEW_AND_WRITE_SCOPE_DRIFT");
  }
  const input = await readInputFromStdin();
  if (approval.archiveSha256 !== input.archiveSha256) {
    throw new Error("FIVE_RECOVERY_SOURCE_ARCHIVE_CHANGED");
  }
  const exclusions = readFounderExclusionKeys();
  const historic = JSON.parse(readFileSync(
    "docs/migration/users-production-activation-manifest.json", "utf8",
  )) as { entries: Array<{ sourceRecordKey: string; emailMask: string }> };
  const masks = new Map(historic.entries.map(e => [e.sourceRecordKey, e.emailMask]));
  const planned: Planned[] = [];
  for (let i = 0; i < FIVE_RECOVERY_KEYS.length; i++) {
    const raw = input.sourceRecords[i];
    if (raw.sourceRecordKey !== FIVE_RECOVERY_KEYS[i] ||
        !exclusions.has(raw.sourceRecordKey)) {
      throw new Error("FIVE_RECOVERY_FOUNDER_EXCLUSION_DRIFT");
    }
    const source = sourceCandidate(input, raw);
    const candidate = normalizeUserCandidate(source);
    const draft = buildUserDraft(candidate);
    const canonicalHash = buildUserCanonicalHash(candidate, draft);
    const email = candidate.normalizedEmail;
    if (!email || !draft ||
        masks.get(source.sourceRecordKey)?.toLowerCase() !==
          maskEmail(email)?.toLowerCase()) {
      throw new Error("FIVE_RECOVERY_HISTORICAL_IDENTITY_MISMATCH");
    }
    assertFiveRecoveryPlanApproved(approval.entries[i], {
      sourceRecordKey: source.sourceRecordKey,
      action: "CREATE",
      canonicalHash, candidate, draft,
    }, source.sourceHash);
    planned.push({
      sourceRecordKey: source.sourceRecordKey, email, canonicalHash,
      sourceHash: source.sourceHash, candidate, draft,
    });
  }
  if (new Set(planned.map(p => p.email)).size !== FIVE_RECOVERY_KEYS.length) {
    throw new Error("FIVE_RECOVERY_DUPLICATE_SOURCE_EMAIL");
  }

  const sourceUrl = process.env.SOURCE_DEV_DATABASE_URL;
  const prodUrl = process.env.DATABASE_URL;
  if (!sourceUrl || !prodUrl ||
      parseMigrationDatabaseUrl(sourceUrl).database !== DEV_DATABASE_NAME) {
    throw new Error("FIVE_RECOVERY_TWO_DISTINCT_DATABASE_TARGETS_REQUIRED");
  }
  const dev = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const prod = new PrismaClient();
  try {
    const [devIdentity, prodIdentity] = await Promise.all([
      dev.$queryRawUnsafe<Array<{ current_database: string }>>("SELECT current_database()"),
      prod.$queryRawUnsafe<Array<{ current_database: string }>>("SELECT current_database()"),
    ]);
    if (devIdentity[0]?.current_database !== DEV_DATABASE_NAME) {
      throw new Error("FIVE_RECOVERY_DEV_DATABASE_FINGERPRINT_MISMATCH");
    }
    assertMigrationDatabaseTarget({
      databaseUrl: prodUrl,
      currentDatabase: prodIdentity[0]?.current_database,
      confirmProduction: true, confirmWrites: true,
      acknowledgeProdUserImport: true,
      requireProdUserAcknowledgement: true,
    });
    // The fifth source identity must still match the verified DEV WP lineage.
    await checkDevUser43(dev, planned[4].email);

    const result = await commitApprovedFiveAtomic(
      prod, planned, approval, input.archiveSha256, args.approvedManifestSha256,
    );

    console.log(JSON.stringify({
      result: "FIVE_USER_RECOVERY_COMMIT_SUCCEEDED",
      sourceNamespace: FIVE_RECOVERY_NAMESPACE,
      sourceIds: [7, 17, 22, 42, 43],
      ...result, backupReference: args.backupReference,
      emailsSent: 0, businessWrites: 0, membershipWrites: 0,
      activityWrites: 0, elevatedRoles: 0, existingUserUpdates: 0,
    }, null, 2));
  } finally {
    await Promise.all([dev.$disconnect(), prod.$disconnect()]);
  }
}

if (process.argv[1]?.endsWith("migration-wordpress-five-commit.ts")) {
  main().catch(error => {
    console.error(error instanceof Error && error.message.startsWith("FIVE_RECOVERY_")
      ? error.message : "FIVE_RECOVERY_COMMIT_FAILED_REVIEW_LOGS_PRIVATELY");
    process.exitCode = 1;
  });
}
