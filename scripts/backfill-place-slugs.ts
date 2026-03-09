/**
 * Backfill script to generate slugs for existing Places
 * Safe to run multiple times (idempotent)
 */

import { PrismaClient } from "@prisma/client";
import { generateUniquePlaceSlug } from "../src/lib/slugify";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting Place slug backfill...\n");

  // Find all places without slug
  const placesWithoutSlug = await prisma.place.findMany({
    where: {
      slug: null,
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: {
      createdAt: "asc", // Process oldest first
    },
  });

  if (placesWithoutSlug.length === 0) {
    console.log("✅ All places already have slugs!");
    return;
  }

  console.log(`Found ${placesWithoutSlug.length} places without slugs\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const place of placesWithoutSlug) {
    try {
      // Generate unique slug
      const slug = await generateUniquePlaceSlug(prisma, place.title);

      // Update place with slug
      await prisma.place.update({
        where: { id: place.id },
        data: { slug },
      });

      console.log(`✓ ${place.title}`);
      console.log(`  ID: ${place.id}`);
      console.log(`  Slug: ${slug}\n`);

      successCount++;
    } catch (error) {
      console.error(`✗ Failed to generate slug for: ${place.title}`);
      console.error(`  ID: ${place.id}`);
      console.error(`  Error: ${error instanceof Error ? error.message : String(error)}\n`);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Successfully generated ${successCount} slugs`);
  if (errorCount > 0) {
    console.log(`❌ Failed to generate ${errorCount} slugs`);
  }
  console.log("=".repeat(50));
}

main()
  .catch((error) => {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
