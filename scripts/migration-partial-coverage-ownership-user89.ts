import { PrismaClient } from "@prisma/client";

import { planBusinessOwnershipGolden, writeBusinessOwnershipGolden, type BusinessOwnershipGoldenCandidate } from "../src/lib/migration/commit/business-ownership/BusinessOwnershipGoldenRunner";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 13 golden proof: the second (and larger) of the 2
 * partial-coverage business-linked users identified in Slice 11 —
 * `wordpress-db:user:89`. Reuses `BusinessOwnershipGoldenRunner`
 * completely unchanged (the same runner from Slice 7 and Slice 12); the
 * candidate's `placeSourcePostIds` is a deliberately fixed manifest of
 * exactly the 19 already-migrated (`publish`-status) Places out of the
 * user's 214 owned Places in WordPress. The other 195 (187 `unpublished`,
 * 8 `draft`) are intentionally excluded — never imported, never
 * referenced by this script.
 *
 * The runner's own preconditions already guarantee this is safe:
 * `planBusinessOwnershipGolden` requires *every* entry in
 * `placeSourcePostIds` to have an exact, active `MigrationLineage` row
 * before returning CREATE, and `writeBusinessOwnershipGolden` re-verifies
 * every Place is still unowned inside one atomic (Serializable)
 * transaction, using a conditional `updateMany` guarded on
 * `ownerBusinessId: null` — any Place claimed concurrently, or any
 * mismatch versus this exact 19-Place set, aborts the whole write with
 * zero partial mutation.
 *
 * Role is left untouched (USER).
 */
const GOLDEN_CANDIDATE: BusinessOwnershipGoldenCandidate = {
  sourceRecordKey: "wordpress-db:user:89",
  legacyUserId: 89,
  placeSourcePostIds: [
    // publish-status Places only (19 of 214 owned); 195 unpublished/draft Places are excluded by design
    "437",
    "5457",
    "5492",
    "5515",
    "5528",
    "5579",
    "12447",
    "12923",
    "13311",
    "13317",
    "13322",
    "13323",
    "13324",
    "13327",
    "13331",
    "45846",
    "48372",
    "49952",
    "49977",
  ],
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
    console.log(
      JSON.stringify(
        {
          mode: args.confirmWrites ? "COMMIT" : "DRY_RUN",
          sourceRecordKey: plan.candidate.sourceRecordKey,
          action: plan.action,
          reason: plan.reason,
          targetUserId: plan.targetUserId,
          targetPlaceCount: plan.targetPlaceIds.length,
          expectedTargetPlaceCount: GOLDEN_CANDIDATE.placeSourcePostIds.length,
          excludedPlaceCount: 195,
        },
        null,
        2,
      ),
    );

    if (!args.confirmWrites) return;

    const result = await writeBusinessOwnershipGolden(prisma, plan);
    console.log(JSON.stringify({ complete: true, action: result.action, businessId: result.businessId, placeCount: result.placeIds.length, roleChanges: 0 }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
