import { PrismaClient } from "@prisma/client";

import { planBusinessOwnershipGolden, writeBusinessOwnershipGolden, type BusinessOwnershipGoldenCandidate } from "../src/lib/migration/commit/business-ownership/BusinessOwnershipGoldenRunner";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

/**
 * USERS Slice 12 golden proof: the first of the 2 partial-coverage
 * business-linked users identified in Slice 11 —
 * `wordpress-db:user:130`. Reuses `BusinessOwnershipGoldenRunner`
 * completely unchanged; the only difference from Slice 7 is that the
 * candidate's `placeSourcePostIds` is a deliberately fixed, reduced
 * manifest containing *only* the one already-migrated (`publish`-status)
 * Place — the one still-draft Place (`wordpress-db:places:30605`) is
 * intentionally excluded, never imported or referenced by this script.
 *
 * Role is left untouched (USER). `wordpress-db:user:89` is a separate,
 * much larger partial-coverage case (19 migrated / 195 excluded Places)
 * and is deliberately out of scope for this slice.
 */
const GOLDEN_CANDIDATE: BusinessOwnershipGoldenCandidate = {
  sourceRecordKey: "wordpress-db:user:130",
  legacyUserId: 130,
  placeSourcePostIds: ["18886"], // publish-status Place only; wordpress-db:places:30605 (draft) is excluded by design
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
    console.log(JSON.stringify({ mode: args.confirmWrites ? "COMMIT" : "DRY_RUN", sourceRecordKey: plan.candidate.sourceRecordKey, action: plan.action, reason: plan.reason, targetUserId: plan.targetUserId, targetPlaceIds: plan.targetPlaceIds, excludedDraftPlaceSourcePostId: "30605" }, null, 2));

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
