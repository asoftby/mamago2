import { PrismaClient } from "@prisma/client";

import { executeBusinessOwnershipBatch } from "../src/lib/migration/commit/business-ownership/BusinessOwnershipBatchRunner";
import { buildBusinessOwnershipBatchManifest } from "../src/lib/migration/commit/business-ownership/buildBusinessOwnershipBatchManifest";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 8: batch business-ownership write over the remaining
 * `EXACT_LINK_CANDIDATE` entries (35, having already written
 * `wordpress-db:user:38` in Slice 7). Reuses the exact Slice 7 write path
 * per candidate — no relaxed guards, no new write logic. Sequential,
 * stop-on-first-error: the moment one candidate comes back BLOCKED, the
 * script halts and reports; already-written candidates are left in place.
 *
 * Deliberately excludes the two partial-lineage cases
 * (`wordpress-db:user:89`, `wordpress-db:user:130`), all 15
 * manual/privileged users, all 12 content-author users, and any role
 * change — all of those stay out of scope for this slice.
 */
const ALREADY_DONE = ["wordpress-db:user:38"];

interface Args {
  snapshotRoot: string;
  confirmWrites: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const confirmWrites = argv.includes("--confirm-writes");
  const dryRun = argv.includes("--dry-run");
  if (confirmWrites === dryRun) throw new Error("Choose exactly one of --dry-run or --confirm-writes.");
  const rootIndex = argv.indexOf("--snapshot-root");
  if (rootIndex < 0 || !argv[rootIndex + 1]) throw new Error("Batch requires --snapshot-root.");
  return { snapshotRoot: argv[rootIndex + 1], confirmWrites };
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
}

async function captureAudit(prisma: PrismaClient): Promise<AuditCounts> {
  const [user, session, userActionToken, business, place, offer, article, route, activity, mediaAsset] = await Promise.all([
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
  ]);
  return { user, session, userActionToken, business, place, offer, article, route, activity, mediaAsset };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertLocalDatabaseUrl(process.env.DATABASE_URL);

  const prisma = new PrismaClient();
  try {
    const manifest = await buildBusinessOwnershipBatchManifest(prisma, args.snapshotRoot, ALREADY_DONE);
    console.log(JSON.stringify({ mode: args.confirmWrites ? "COMMIT" : "DRY_RUN", manifestSize: manifest.length, sourceRecordKeys: manifest.map(entry => entry.sourceRecordKey) }, null, 2));

    if (!args.confirmWrites) return;

    let baseline = await captureAudit(prisma);
    const summary = await executeBusinessOwnershipBatch(prisma, manifest, {
      afterEach: async (result, index) => {
        const audit = await captureAudit(prisma);
        const expectedBusinessDelta = result.action === "CREATE" ? 1 : 0;
        if (audit.business - baseline.business !== expectedBusinessDelta) throw new Error(`BATCH_AUDIT_DELTA_MISMATCH:business:${index}:${result.sourceRecordKey}`);
        for (const key of ["user", "session", "userActionToken", "place", "offer", "article", "route", "activity", "mediaAsset"] as const) {
          if (audit[key] !== baseline[key]) throw new Error(`BATCH_AUDIT_FORBIDDEN_DELTA:${key}:${index}:${result.sourceRecordKey}`);
        }
        baseline = audit;
        console.log(JSON.stringify({ step: index + 1, of: manifest.length, sourceRecordKey: result.sourceRecordKey, action: result.action, reason: result.reason, businessId: result.businessId }));
      },
    });

    console.log(JSON.stringify({ complete: true, total: summary.total, processed: summary.processed, create: summary.create, skipUnchanged: summary.skipUnchanged, blocked: summary.blocked, stoppedEarly: summary.stoppedEarly, roleChanges: 0 }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
