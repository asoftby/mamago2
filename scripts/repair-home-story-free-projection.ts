/**
 * Repairs HomeStoryItem.isFree for PUBLISHED Event Activities.
 *
 * Root cause: `syncEventHomeStoriesProjection` used to derive `isFree`
 * solely from `activity.priceFrom === 0`, but the free pricing mode in the
 * event wizard clears `priceFrom` to null and instead sets
 * `scheduleJson.pricingMode = "free"` / `priceText = "бесплатно"`. Those
 * events silently never joined the "Бесплатно" home Story. The fix lives in
 * `isStructuredFreeEvent` (`src/server/discovery/eventFilterSemantics.ts`),
 * which both the discovery free-filter and this projection now share.
 *
 * This script re-runs `syncEventHomeStoriesProjection` (the pure, next/cache
 * -free projection core) for every PUBLISHED Event that has at least one
 * future ActivitySession, which recomputes `isFree` with the fixed logic
 * for both new and pre-existing HomeStoryItem rows. It is idempotent — safe
 * to run repeatedly — and never touches EXCLUDE/FORCE_INCLUDE/pinned/
 * manualOrder/display-window editorial fields, since
 * `syncEventHomeStoriesProjection` already preserves those (see its
 * `EXCLUDE` skip and its `create`/`update` field lists).
 *
 * Preview (no writes, default):
 *   pnpm tsx scripts/repair-home-story-free-projection.ts --preview
 *
 * Write (local DB only by default; PROD needs --confirm-production too):
 *   pnpm tsx scripts/repair-home-story-free-projection.ts --confirm-writes
 */
import { PrismaClient, ContentStatus, HomeStorySourceType } from "@prisma/client";

import { assertMigrationDatabaseTarget } from "../src/lib/migration/runtime/migrationDatabaseTarget";
import { isStructuredFreeEvent } from "../src/server/discovery/eventFilterSemantics";
import { syncEventHomeStoriesProjection } from "../src/server/stories/syncEventHomeStoriesProjection";

interface Args {
  preview: boolean;
  confirmWrites: boolean;
  confirmProduction: boolean;
}

export function parseRepairArgs(argv: readonly string[]): Args {
  const preview = argv.includes("--preview");
  const confirmWrites = argv.includes("--confirm-writes");
  if (preview === confirmWrites) throw new Error("Choose exactly one of --preview or --confirm-writes.");
  return { preview, confirmWrites, confirmProduction: argv.includes("--confirm-production") };
}

async function queryCurrentDatabase(prisma: PrismaClient): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  return rows[0]?.current_database ?? "";
}

async function main(): Promise<void> {
  const args = parseRepairArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const currentDatabase = await queryCurrentDatabase(prisma);
    assertMigrationDatabaseTarget({
      databaseUrl: process.env.DATABASE_URL,
      confirmProduction: args.confirmProduction,
      confirmWrites: args.confirmWrites,
      currentDatabase,
      requireProdUserAcknowledgement: false,
    });

    const now = new Date();
    const activities = await prisma.activity.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        type: "EVENT",
        sessions: { some: { startsAt: { gte: now } } },
      },
      select: { id: true, title: true, priceFrom: true, priceTo: true, priceText: true, scheduleJson: true },
      orderBy: { id: "asc" },
    });

    let repaired = 0;
    let alreadyCorrect = 0;
    for (const activity of activities) {
      const expectedIsFree = isStructuredFreeEvent(activity);
      const existing = await prisma.homeStoryItem.findMany({
        where: { sourceType: HomeStorySourceType.EVENT, sourceId: activity.id },
        select: { isFree: true, status: true },
      });
      const mismatched = existing.some((item) => item.status === "ACTIVE" && item.isFree !== expectedIsFree);
      const missing = expectedIsFree && existing.length === 0;

      if (!mismatched && !missing) {
        alreadyCorrect += 1;
        continue;
      }

      console.log(JSON.stringify({
        activityId: activity.id, title: activity.title, expectedIsFree, mode: args.confirmWrites ? "WRITE" : "PREVIEW",
      }));

      if (args.confirmWrites) {
        await syncEventHomeStoriesProjection(activity.id);
      }
      repaired += 1;
    }

    console.log(JSON.stringify({
      complete: true,
      mode: args.confirmWrites ? "WRITE" : "PREVIEW",
      totalPublishedEventsWithFutureSessions: activities.length,
      alreadyCorrect,
      repaired,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("repair-home-story-free-projection.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
