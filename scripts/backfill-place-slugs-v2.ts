/**
 * Backfill script for Place slugs (v2 - human-readable)
 * 
 * Generates human-readable slugs for all published places
 * Handles duplicates by adding address information
 * 
 * Usage: npx tsx scripts/backfill-place-slugs-v2.ts
 */

import { PrismaClient } from "@prisma/client";
import { generatePlaceSlug } from "../src/lib/slug/placeSlugService";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Place slug backfill (v2 - human-readable)...\n");

  // Get all published places without slugs
  const places = await prisma.place.findMany({
    where: {
      status: "PUBLISHED",
      archivedAt: null,
      OR: [
        { slug: null },
        { slug: "" },
      ],
    },
    select: {
      id: true,
      title: true,
      cityId: true,
      formattedAddr: true,
      customAddress: true,
      shortAddress: true,
      slug: true,
    },
    orderBy: [
      { cityId: "asc" },
      { title: "asc" },
    ],
  });

  console.log(`📊 Found ${places.length} places without slugs\n`);

  if (places.length === 0) {
    console.log("✅ All places already have slugs!");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  // Process places one by one
  for (const place of places) {
    try {
      console.log(`Processing: ${place.title} (${place.id})`);
      
      // Generate slug
      const slug = await generatePlaceSlug(place);
      
      // Update place
      await prisma.place.update({
        where: { id: place.id },
        data: {
          slug,
          slugUpdatedAt: new Date(),
        },
      });
      
      console.log(`  ✅ Assigned slug: ${slug}\n`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ Error for ${place.title}:`, error);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📈 Backfill Summary:");
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📊 Total: ${places.length}`);
  console.log("=".repeat(50));

  // Show some examples
  console.log("\n📝 Sample slugs:");
  const samples = await prisma.place.findMany({
    where: {
      status: "PUBLISHED",
      archivedAt: null,
      slug: { not: null },
    },
    select: {
      title: true,
      slug: true,
      city: {
        select: { name: true },
      },
    },
    take: 10,
  });

  for (const sample of samples) {
    console.log(`  ${sample.title} → /places/${sample.slug}`);
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
