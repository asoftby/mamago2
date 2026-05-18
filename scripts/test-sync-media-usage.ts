/**
 * Test syncActivityMediaUsage function
 * Run: npx tsx scripts/test-sync-media-usage.ts
 */

import { PrismaClient } from "@prisma/client";
import { syncActivityMediaUsage } from "../src/server/services/media/media-usage.service";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Testing syncActivityMediaUsage ===\n");

  // Find the test activity
  const activity = await prisma.activity.findFirst({
    where: {
      title: { contains: "Тестовое" },
    },
    select: {
      id: true,
      title: true,
      coverImageId: true,
    },
  });

  if (!activity) {
    console.log("❌ Activity not found!");
    return;
  }

  console.log("Found activity:");
  console.log(`  ID: ${activity.id}`);
  console.log(`  Title: ${activity.title}`);
  console.log(`  coverImageId: ${activity.coverImageId || "NULL"}`);

  if (!activity.coverImageId) {
    console.log("\n❌ No coverImageId - nothing to sync!");
    return;
  }

  // Check MediaUsage BEFORE sync
  console.log("\n--- BEFORE SYNC ---");
  const usagesBefore = await prisma.mediaUsage.findMany({
    where: {
      entityType: "EVENT",
      entityId: activity.id,
    },
  });
  console.log(`MediaUsage records: ${usagesBefore.length}`);

  // Run sync
  console.log("\n--- RUNNING SYNC ---");
  try {
    const result = await syncActivityMediaUsage(activity.id);
    console.log("✅ Sync completed successfully!");
    console.log(`Result:`, result);
  } catch (error) {
    console.error("❌ Sync failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack:", error.stack);
    }
    return;
  }

  // Check MediaUsage AFTER sync
  console.log("\n--- AFTER SYNC ---");
  const usagesAfter = await prisma.mediaUsage.findMany({
    where: {
      entityType: "EVENT",
      entityId: activity.id,
    },
    include: {
      media: {
        select: {
          filename: true,
        },
      },
    },
  });
  console.log(`MediaUsage records: ${usagesAfter.length}`);
  usagesAfter.forEach((usage) => {
    console.log(`  - ${usage.field} → ${usage.media.filename}`);
  });

  // Check media asset usage count
  if (activity.coverImageId) {
    const mediaUsageCount = await prisma.mediaUsage.count({
      where: { mediaId: activity.coverImageId },
    });
    console.log(`\nTotal usages for media ${activity.coverImageId}: ${mediaUsageCount}`);
  }

  console.log("\n=== Test Complete ===");
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
