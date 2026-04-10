/**
 * Migrate existing places to stable slug logic
 * 
 * This script:
 * 1. Finds all published places without slug or with old slug format
 * 2. Regenerates slugs using new stable logic
 * 3. Preserves old slugs in history for SEO redirects
 * 
 * IMPORTANT: Run this ONCE to migrate existing data
 */

import { PrismaClient } from "@prisma/client";
import { assignSlugOnPublish } from "../../src/lib/slug/placeSlugService";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Migrating places to stable slug logic\n");
  console.log("=".repeat(60));

  // Find all published places
  const places = await prisma.place.findMany({
    where: {
      status: "PUBLISHED",
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      cityId: true,
      formattedAddr: true,
      shortAddress: true,
    },
    orderBy: [
      { cityId: "asc" },
      { title: "asc" },
    ],
  });

  console.log(`\nFound ${places.length} published places\n`);

  if (places.length === 0) {
    console.log("No places to migrate");
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const place of places) {
    try {
      const oldSlug = place.slug;
      
      console.log(`\n📍 ${place.title}`);
      console.log(`   ID: ${place.id}`);
      console.log(`   Old slug: ${oldSlug || "(none)"}`);
      
      // Assign/update slug using new logic
      const newSlug = await assignSlugOnPublish(place.id);
      
      if (oldSlug === newSlug) {
        console.log(`   ✅ Slug unchanged: ${newSlug}`);
        skipped++;
      } else {
        console.log(`   🔄 New slug: ${newSlug}`);
        if (oldSlug) {
          console.log(`   📝 Old slug saved to history`);
        }
        updated++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errors++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Migration Summary:");
  console.log(`   Total places: ${places.length}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Unchanged: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log("=".repeat(60));

  if (updated > 0) {
    console.log("\n✅ Migration completed!");
    console.log("\nNext steps:");
    console.log("1. Test public URLs: npx tsx scripts/list-place-urls.ts");
    console.log("2. Verify redirects work for old slugs");
    console.log("3. Check display titles in UI");
  }
}

main()
  .catch((e) => {
    console.error("\n❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
