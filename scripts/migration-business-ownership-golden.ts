import { PrismaClient } from "@prisma/client";

import { planBusinessOwnershipGolden, writeBusinessOwnershipGolden, type BusinessOwnershipGoldenCandidate } from "../src/lib/migration/commit/business-ownership/BusinessOwnershipGoldenRunner";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 7 golden proof. The authorized scope is exactly one
 * `EXACT_LINK_CANDIDATE` from `docs/migration/business-ownership-plan.json`
 * — `wordpress-db:user:38`, chosen for minimal complexity (single owned
 * Place, no existing Business, full lineage coverage, no conflicts). This
 * candidate is hardcoded rather than accepted as a CLI argument so this
 * script cannot be pointed at any of the other 35 candidates or at the
 * manual/privileged, content-author, media, or role-elevation scope —
 * all of those stay explicitly deferred to later slices.
 */
const GOLDEN_CANDIDATE: BusinessOwnershipGoldenCandidate = {
  sourceRecordKey: "wordpress-db:user:38",
  legacyUserId: 38,
  placeSourcePostIds: ["9870"],
};

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
    const plan = await planBusinessOwnershipGolden(prisma, GOLDEN_CANDIDATE);
    console.log(JSON.stringify({ mode: args.confirmWrites ? "COMMIT" : "DRY_RUN", sourceRecordKey: plan.candidate.sourceRecordKey, action: plan.action, reason: plan.reason, targetUserId: plan.targetUserId, targetPlaceIds: plan.targetPlaceIds }, null, 2));

    if (!args.confirmWrites) return;

    const result = await writeBusinessOwnershipGolden(prisma, plan);
    console.log(JSON.stringify({ complete: true, action: result.action, businessId: result.businessId, placeIds: result.placeIds, roleChanges: 0 }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
