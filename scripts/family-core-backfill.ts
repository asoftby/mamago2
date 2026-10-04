/**
 * Family Core B1 backfill. Idempotent.
 *
 *   tsx scripts/family-core-backfill.ts --dry-run          # reads only
 *   tsx scripts/family-core-backfill.ts                    # Family/Membership/Child/PlanItem
 *   tsx scripts/family-core-backfill.ts --events --dry-run # UserEvent.familyId preview
 *   tsx scripts/family-core-backfill.ts --events           # run LAST, resumable
 *
 * Families are created only for live users that already own a Child or a
 * PlanItem; everyone else gets a family lazily via ensureFamilyForUser.
 * Stops (no writes) if any PlanItem.userId != Child.parentId.
 */
import { PrismaClient } from "@prisma/client";

import {
  FamilyBackfillStop,
  runEventsBackfill,
  runFamilyBackfill,
} from "../src/server/family/familyBackfill";

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const events = args.has("--events");
  const prisma = new PrismaClient();
  try {
    const report = events
      ? await runEventsBackfill(prisma, { dryRun })
      : await runFamilyBackfill(prisma, { dryRun });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error instanceof FamilyBackfillStop) {
    console.error(`STOP: ${error.message}`);
    console.error(JSON.stringify(error.details, null, 2));
  } else {
    console.error(error);
  }
  process.exit(1);
});
