import { PrismaClient } from "@prisma/client";

import { buildRoleElevationBatchManifest } from "../src/lib/migration/commit/business-ownership/buildRoleElevationBatchManifest";
import { executeRoleElevationBatch } from "../src/lib/migration/commit/business-ownership/RoleElevationBatchRunner";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 10: batch role elevation over the remaining 35 Users whose
 * Business + Place ownership link was already written (Slices 7/8).
 * Reuses the exact Slice 9 write path per candidate — no relaxed guards,
 * no new write logic. Sequential, stop-on-first-error.
 *
 * Deliberately excludes `wordpress-db:user:38` (already elevated in
 * Slice 9), the 2 partial-lineage cases, all manual/privileged users, and
 * all content-author users — all of those stay out of scope.
 */
const ALREADY_DONE = ["wordpress-db:user:38"];

function parseArgs(argv: readonly string[]): { confirmWrites: boolean } {
  const confirmWrites = argv.includes("--confirm-writes");
  const dryRun = argv.includes("--dry-run");
  if (confirmWrites === dryRun) throw new Error("Choose exactly one of --dry-run or --confirm-writes.");
  return { confirmWrites };
}

interface AuditCounts {
  user: number;
  session: number;
  userActionToken: number;
  business: number;
  place: number;
  offer: number;
  article: number;
  route: number;
  activity: number;
  mediaAsset: number;
  migrationLineage: number;
  migrationRecord: number;
}

async function captureAudit(prisma: PrismaClient): Promise<AuditCounts> {
  const [user, session, userActionToken, business, place, offer, article, route, activity, mediaAsset, migrationLineage, migrationRecord] = await Promise.all([
    prisma.user.count(),
    prisma.session.count(),
    prisma.userActionToken.count(),
    prisma.business.count(),
    prisma.place.count(),
    prisma.offer.count(),
    prisma.article.count(),
    prisma.route.count(),
    prisma.activity.count(),
    prisma.mediaAsset.count(),
    prisma.migrationLineage.count(),
    prisma.migrationRecord.count(),
  ]);
  return { user, session, userActionToken, business, place, offer, article, route, activity, mediaAsset, migrationLineage, migrationRecord };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertLocalDatabaseUrl(process.env.DATABASE_URL);

  const prisma = new PrismaClient();
  try {
    const manifest = await buildRoleElevationBatchManifest(prisma, ALREADY_DONE);
    console.log(JSON.stringify({ mode: args.confirmWrites ? "COMMIT" : "DRY_RUN", manifestSize: manifest.length, sourceRecordKeys: manifest.map(entry => entry.sourceRecordKey) }, null, 2));

    if (!args.confirmWrites) return;

    // Every count except User is expected to stay exactly flat — role elevation touches nothing but User.role.
    let baseline = await captureAudit(prisma);
    const summary = await executeRoleElevationBatch(prisma, manifest, {
      afterEach: async (result, index) => {
        const audit = await captureAudit(prisma);
        for (const key of Object.keys(baseline) as Array<keyof AuditCounts>) {
          if (audit[key] !== baseline[key]) throw new Error(`BATCH_AUDIT_FORBIDDEN_DELTA:${key}:${index}:${result.sourceRecordKey}`);
        }
        baseline = audit;
        console.log(JSON.stringify({ step: index + 1, of: manifest.length, sourceRecordKey: result.sourceRecordKey, action: result.action, reason: result.reason, targetUserId: result.targetUserId }));
      },
    });

    console.log(JSON.stringify({ complete: true, total: summary.total, processed: summary.processed, elevate: summary.elevate, skipUnchanged: summary.skipUnchanged, blocked: summary.blocked, stoppedEarly: summary.stoppedEarly, businessChanges: 0, placeChanges: 0, statusChanges: 0, passwordChanges: 0, sessionChanges: 0 }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
