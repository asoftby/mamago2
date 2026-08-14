/**
 * Live WordPress-Voxel avatar backfill for already-migrated Users.
 *
 * This is a USER-ONLY replay, not a User importer: it never creates a
 * User, only ever writes `User.avatarUrl` on a User that already exists
 * via an active `MigrationLineage(targetType: USER)` row created by
 * `pnpm migration:user:live`. If that row is missing, the user is reported
 * `USER_NOT_MIGRATED_YET` and skipped — never created here. Every write is
 * the single narrow statement
 * `updateMany({ where: { id, avatarUrl: null }, data: { avatarUrl } })`,
 * so an avatar already set (by an earlier run of this same script, or by
 * the user uploading their own photo in the app) is never overwritten, and
 * no other User column is ever touched. See `UserAvatarSyncer` for the
 * per-user import/reuse/skip logic.
 *
 * Eligibility/founder-exclusion rules are unchanged — reuses
 * `classifyLiveUserEligibility`/`readFounderExclusionKeys` from
 * `liveWordPressUserSource.ts` exactly as `migration-user-live.ts` does.
 *
 * Avatar source: `wp_usermeta.meta_key = 'voxel:avatar'` only (Voxel's
 * custom-avatar attachment-id reference). Telegram login photos
 * (`wptg_login_avatar`, `t.me` URLs), Gravatar, and the theme's
 * mystery/default placeholder are never read — see `voxelAvatarSource.ts`.
 *
 * Fail-closed, same as `migration-user-live.ts`:
 *   localhost:5433/mamago2 is allowed without extra flags.
 *   prodmamago requires --confirm-production, and writes additionally
 *   require --confirm-writes --acknowledge-prod-user-import.
 *
 * Preview (no writes, no media download, no live-WP HTTP fetch — only the
 * read-only WordPress DB queries needed to classify each user):
 *   pnpm migration:user:avatar-backfill --preview --allow-remote-readonly
 *
 * Commit (writes User.avatarUrl and downloads avatar image bytes from the
 * live WordPress host over HTTPS — never via SSH):
 *   pnpm migration:user:avatar-backfill --confirm-writes --allow-remote-readonly \
 *     [--confirm-production --acknowledge-prod-user-import]
 */
import { PrismaClient } from "@prisma/client";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import { WordPressRepository } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import { WORDPRESS_DB_ADAPTER_KEY } from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import {
  LIVE_USER_SOURCE_NAMESPACE,
  classifyLiveUserEligibility,
  liveUserSourceRecordKey,
  readFounderExclusionKeys,
} from "../src/lib/migration/commit/user/liveWordPressUserSource";
import { UserAvatarSyncer } from "../src/lib/migration/commit/user/UserAvatarSyncer";
import { VOXEL_AVATAR_META_KEY, classifyVoxelAvatarSource, type VoxelAvatarSourceClassification } from "../src/lib/migration/commit/user/voxelAvatarSource";
import { MigrationLineageWriter } from "../src/lib/migration/lineage/MigrationLineageWriter";
import type { MediaImporterLike } from "../src/lib/migration/media/types";
import { assertMigrationDatabaseTarget } from "../src/lib/migration/runtime/migrationDatabaseTarget";
import { installServerOnlyStub } from "./migration-commit-wordpress-db";

type Args = {
  preview: boolean;
  confirmWrites: boolean;
  confirmProduction: boolean;
  acknowledgeProdUserImport: boolean;
  allowRemoteReadonly: boolean;
  limit?: number;
};

export function parseUserAvatarBackfillArgs(argv: readonly string[]): Args {
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

/** What `--preview` reports for a VALID attachment — no import is attempted, so no import/reuse distinction exists yet. */
function previewOutcome(status: VoxelAvatarSourceClassification["status"]): string {
  if (status === "AVATAR_ATTACHMENT_VALID") return "AVATAR_ELIGIBLE_FOR_IMPORT";
  return status;
}

async function main(): Promise<void> {
  const args = parseUserAvatarBackfillArgs(process.argv.slice(2));
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
    const repo = new WordPressRepository(executor);

    const users = await repo.getUsers(args.limit ?? 20000);
    const excluded = readFounderExclusionKeys();
    const eligibleUsers = users.filter(
      (row) => classifyLiveUserEligibility(liveUserSourceRecordKey(row.ID), excluded).eligible,
    );

    const userIds = eligibleUsers.map((row) => row.ID);
    const avatarMetaByUser = await repo.getUserMetaByKey(userIds, VOXEL_AVATAR_META_KEY);

    // Only ask WordPress for ids that look like plausible attachment ids —
    // classifyVoxelAvatarSource() still makes the final per-user call
    // (AVATAR_NON_ATTACHMENT_VALUE) regardless; this is purely to keep the
    // batched attachments query from being asked about e.g. a Gravatar hash.
    const candidateAttachmentIds = [
      ...new Set(
        [...avatarMetaByUser.values()]
          .map((row) => row.meta_value?.trim())
          .filter((value): value is string => Boolean(value) && /^[0-9]+$/.test(value!))
          .map((value) => Number(value)),
      ),
    ];
    const attachmentsById = await repo.getAttachmentsByIds(candidateAttachmentIds);

    // USER lineage source: the exact MigrationSource `migration-user-live.ts`
    // commits against — a target User is only ever touched if it was
    // created there.
    const userSource = await prisma.migrationSource.findUnique({
      where: { adapterKey_sourceNamespace: { adapterKey: WORDPRESS_DB_ADAPTER_KEY, sourceNamespace: LIVE_USER_SOURCE_NAMESPACE } },
    });

    // Lazy — see migration-commit-wordpress-db.ts's installServerOnlyStub()
    // doc comment: createMamagoMediaImporter transitively imports a
    // `server-only`-guarded module that throws unconditionally outside
    // Next's bundler the moment it's loaded, so it must never be imported
    // in --preview (which never needs it).
    let createMamagoMediaImporter: typeof import("../src/lib/migration/media")["createMamagoMediaImporter"] | undefined;
    if (args.confirmWrites) {
      installServerOnlyStub();
      ({ createMamagoMediaImporter } = await import("../src/lib/migration/media"));
    }
    const mediaImporterFactory = (uploadedByUserId: string): MediaImporterLike => {
      if (!createMamagoMediaImporter) {
        throw new Error("mediaImporterFactory invoked without --confirm-writes — this should be unreachable.");
      }
      return createMamagoMediaImporter({ uploadedByUserId });
    };

    const lineageWriter = new MigrationLineageWriter(prisma);
    const syncer = new UserAvatarSyncer({ prisma, mediaImporterFactory, lineageWriter });

    // MEDIA_ASSET lineage/dedup source: the same MigrationSource the main
    // content commit pipeline (migration-commit-wordpress-db.ts) writes
    // WordPress-attachment lineage under (`buildExecutionPlanInput`'s
    // `sourceNamespace: "wordpress-db"`). Reusing it — rather than a
    // dedicated avatar-only source — means an attachment already imported
    // by/for anything else is found and reused here too, and vice versa.
    const mediaSource = args.confirmWrites
      ? await prisma.migrationSource.upsert({
          where: { adapterKey_sourceNamespace: { adapterKey: WORDPRESS_DB_ADAPTER_KEY, sourceNamespace: WORDPRESS_DB_ADAPTER_KEY } },
          create: { adapterKey: WORDPRESS_DB_ADAPTER_KEY, sourceNamespace: WORDPRESS_DB_ADAPTER_KEY, name: "WordPress content (live)" },
          update: {},
        })
      : null;

    const counts: Record<string, number> = {};
    const bump = (key: string) => {
      counts[key] = (counts[key] ?? 0) + 1;
    };

    for (const row of eligibleUsers) {
      const sourceRecordKey = liveUserSourceRecordKey(row.ID);
      const rawMetaValue = avatarMetaByUser.get(row.ID)?.meta_value ?? null;
      const avatarSource = classifyVoxelAvatarSource({ rawMetaValue, attachmentsById });

      const targetLineage = userSource
        ? await prisma.migrationLineage.findUnique({
            where: {
              sourceId_sourceRecordKey_targetType_targetRole: {
                sourceId: userSource.id,
                sourceRecordKey,
                targetType: "USER",
                targetRole: "primary",
              },
            },
            select: { targetId: true, isActive: true },
          })
        : null;

      if (!targetLineage?.isActive || !targetLineage.targetId) {
        bump("USER_NOT_MIGRATED_YET");
        console.log(JSON.stringify({ sourceRecordKey, outcome: "USER_NOT_MIGRATED_YET", mode: args.preview ? "PREVIEW" : "COMMIT" }));
        continue;
      }

      if (!args.confirmWrites || !mediaSource) {
        const outcome = previewOutcome(avatarSource.status);
        bump(outcome);
        console.log(JSON.stringify({ sourceRecordKey, userId: targetLineage.targetId, outcome, mode: "PREVIEW" }));
        continue;
      }

      const result = await syncer.sync({
        userId: targetLineage.targetId,
        sourceRecordKey,
        avatarSource,
        sourceId: mediaSource.id,
        sourceHash: sourceRecordKey,
      });
      bump(result.outcome);
      console.log(JSON.stringify({ sourceRecordKey, userId: targetLineage.targetId, outcome: result.outcome, mode: "COMMIT" }));
    }

    console.log(JSON.stringify({ complete: true, totalEligible: eligibleUsers.length, ...counts }));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("migration-user-avatar-backfill.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
