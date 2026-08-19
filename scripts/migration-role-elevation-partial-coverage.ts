import { PrismaClient } from "@prisma/client";

import { executeRoleElevationBatch } from "../src/lib/migration/commit/business-ownership/RoleElevationBatchRunner";
import { planRoleElevationGolden, type RoleElevationGoldenCandidate } from "../src/lib/migration/commit/business-ownership/RoleElevationGoldenRunner";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 14: role elevation for exactly the 2 partial-coverage
 * business-linked users whose ownership was written in Slice 12/13 —
 * `wordpress-db:user:89` and `wordpress-db:user:130`. Reuses
 * `RoleElevationBatchRunner` (Slice 10) completely unchanged, with a
 * hardcoded 2-candidate manifest rather than a live query, so this
 * script cannot accidentally touch any of the 36 users already elevated
 * in Slice 9/10.
 *
 * Closes out the business-linked ownership workstream: after this slice,
 * all 38 business-linked users have both a real Business + Place
 * ownership link and the correct BUSINESS_OWNER role.
 */
const CANDIDATES: readonly RoleElevationGoldenCandidate[] = [{ sourceRecordKey: "wordpress-db:user:89" }, { sourceRecordKey: "wordpress-db:user:130" }];

function parseArgs(argv: readonly string[]): { confirmWrites: boolean } {
  const confirmWrites = argv.includes("--confirm-writes");
  const dryRun = argv.includes("--dry-run");
  if (confirmWrites === dryRun) throw new Error("Choose exactly one of --dry-run or --confirm-writes.");
  return { confirmWrites };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertLocalDatabaseUrl(process.env.DATABASE_URL);

  const prisma = new PrismaClient();
  try {
    if (!args.confirmWrites) {
      for (const candidate of CANDIDATES) {
        const plan = await planRoleElevationGolden(prisma, candidate);
        console.log(JSON.stringify({ mode: "DRY_RUN", sourceRecordKey: plan.candidate.sourceRecordKey, action: plan.action, reason: plan.reason, targetUserId: plan.targetUserId, businessId: plan.businessId, linkedPlaceIds: plan.linkedPlaceIds }, null, 2));
      }
      return;
    }

    const summary = await executeRoleElevationBatch(prisma, CANDIDATES, {
      afterEach: async (result, index) => {
        console.log(JSON.stringify({ step: index + 1, of: CANDIDATES.length, sourceRecordKey: result.sourceRecordKey, action: result.action, reason: result.reason, targetUserId: result.targetUserId }));
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
