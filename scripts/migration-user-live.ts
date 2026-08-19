/**
 * Live WordPress user import (preview by default).
 *
 * Fail-closed:
 *   localhost:5433/mamago2 is allowed without extra flags.
 *   prodmamago requires --confirm-production, and writes additionally
 *   require --confirm-writes --acknowledge-prod-user-import.
 *
 * Does not migrate passwords, send activation email, SMS, or Telegram.
 * Privileged target accounts are never overwritten.
 *
 * Preview (no writes):
 *   pnpm migration:user:live --preview --allow-remote-readonly
 *
 * Commit is owner-controlled and is NOT used by the readiness task.
 */
import { createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import { WordPressRepository } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import {
  LIVE_USER_SOURCE_NAMESPACE,
  classifyLiveUserEligibility,
  readFounderExclusionKeys,
  userSourceCandidateFromWordPressRow,
} from "../src/lib/migration/commit/user/liveWordPressUserSource";
import {
  maskEmail,
  normalizeUserCandidate,
  planUserMigration,
  writeUserMigration,
} from "../src/lib/migration/commit/user/UserMigrationVerticalSlice";
import { assertMigrationDatabaseTarget } from "../src/lib/migration/runtime/migrationDatabaseTarget";

type Args = {
  preview: boolean;
  confirmWrites: boolean;
  confirmProduction: boolean;
  acknowledgeProdUserImport: boolean;
  allowRemoteReadonly: boolean;
  limit?: number;
};

export function parseLiveUserArgs(argv: readonly string[]): Args {
  const preview = argv.includes("--preview");
  const confirmWrites = argv.includes("--confirm-writes");
  if (preview === confirmWrites) throw new Error("Choose exactly one of --preview or --confirm-writes.");
  const limitIndex = argv.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : undefined;
  if (limitIndex >= 0 && (!Number.isFinite(limit) || (limit ?? 0) <= 0)) throw new Error("Invalid --limit.");
  return {
    preview,
    confirmWrites,
    confirmProduction: argv.includes("--confirm-production"),
    acknowledgeProdUserImport: argv.includes("--acknowledge-prod-user-import"),
    allowRemoteReadonly: argv.includes("--allow-remote-readonly"),
    limit,
  };
}

async function queryCurrentDatabase(prisma: PrismaClient): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  return rows[0]?.current_database ?? "";
}

async function main(): Promise<void> {
  const args = parseLiveUserArgs(process.argv.slice(2));
  const wpConfig = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(wpConfig, args.allowRemoteReadonly);

  const prisma = new PrismaClient();
  try {
    const currentDatabase = await queryCurrentDatabase(prisma);
    assertMigrationDatabaseTarget({
      databaseUrl: process.env.DATABASE_URL,
      confirmProduction: args.confirmProduction,
      confirmWrites: args.confirmWrites,
      acknowledgeProdUserImport: args.acknowledgeProdUserImport,
      currentDatabase,
      requireProdUserAcknowledgement: true,
    });

    const executor = createWordPressSshMysqlExecutor(wpConfig);
    const users = await new WordPressRepository(executor).getUsers(args.limit ?? 20000);
    const excluded = readFounderExclusionKeys();
    const snapshotHash = createHash("sha256").update(JSON.stringify(users.map((row) => row.ID))).digest("hex");

    const summary = { total: 0, eligible: 0, excluded: 0, create: 0, skipUnchanged: 0, blocked: 0, error: 0 };
    for (const row of users) {
      summary.total += 1;
      const source = userSourceCandidateFromWordPressRow(row, { excludedKeys: excluded });
      const eligibility = classifyLiveUserEligibility(source.sourceRecordKey, excluded);
      if (!eligibility.eligible) {
        summary.excluded += 1;
        continue;
      }
      summary.eligible += 1;
      const candidate = normalizeUserCandidate(source);
      const plan = await planUserMigration(prisma, candidate, LIVE_USER_SOURCE_NAMESPACE);
      if (plan.action === "CREATE") summary.create += 1;
      else if (plan.action === "SKIP_UNCHANGED") summary.skipUnchanged += 1;
      else summary.blocked += 1;
      console.log(JSON.stringify({
        sourceRecordKey: plan.sourceRecordKey,
        action: plan.action,
        reason: plan.reason,
        emailMask: maskEmail(candidate.normalizedEmail),
        mode: args.preview ? "PREVIEW" : "COMMIT",
      }));
      if (!args.confirmWrites) continue;
      try {
        await writeUserMigration(prisma, plan, LIVE_USER_SOURCE_NAMESPACE, { snapshotHash });
      } catch {
        summary.error += 1;
      }
    }
    console.log(JSON.stringify({ complete: true, ...summary, activationEmails: 0, sms: 0, telegram: 0, passwordsImported: 0 }));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("migration-user-live.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
