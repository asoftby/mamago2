import { PrismaClient } from "@prisma/client";

import { planRoleElevationGolden, writeRoleElevationGolden, type RoleElevationGoldenCandidate } from "../src/lib/migration/commit/business-ownership/RoleElevationGoldenRunner";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 9 golden proof. The authorized scope is exactly one
 * privilege-elevation write — `wordpress-db:user:38`, whose Business and
 * Place-ownership link were already written in Slice 7. This candidate is
 * hardcoded rather than accepted as a CLI argument, so this script cannot
 * be pointed at any of the other 35 business-ownership candidates or at
 * any other User. Elevating the remaining 35 is a separate, explicitly
 * authorized future slice.
 */
const GOLDEN_CANDIDATE: RoleElevationGoldenCandidate = { sourceRecordKey: "wordpress-db:user:38" };

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
    const plan = await planRoleElevationGolden(prisma, GOLDEN_CANDIDATE);
    console.log(JSON.stringify({ mode: args.confirmWrites ? "COMMIT" : "DRY_RUN", sourceRecordKey: plan.candidate.sourceRecordKey, action: plan.action, reason: plan.reason, targetUserId: plan.targetUserId, businessId: plan.businessId, linkedPlaceIds: plan.linkedPlaceIds }, null, 2));

    if (!args.confirmWrites) return;

    const result = await writeRoleElevationGolden(prisma, plan);
    console.log(JSON.stringify({ complete: true, action: result.action, targetUserId: result.targetUserId, businessChanges: 0, placeChanges: 0, statusChanges: 0, passwordChanges: 0, sessionChanges: 0, emailChanges: 0 }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
