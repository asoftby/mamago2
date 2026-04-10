/**
 * Assign slug to a specific place
 * 
 * Usage: npx tsx scripts/data-migrations/assign-slug-to-place.ts <place-id>
 */

import { PrismaClient } from "@prisma/client";
import { assignSlugOnPublish } from "../../src/lib/slug/placeSlugService";

const prisma = new PrismaClient();

async function main() {
  const placeId = process.argv[2];

  if (!placeId) {
    console.log("❌ Please provide a place ID");
    console.log("Usage: npx tsx scripts/data-migrations/assign-slug-to-place.ts <place-id>");
    process.exit(1);
  }

  console.log(`🔍 Looking for place: ${placeId}\n`);

  // Get place
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      cityId: true,
      shortAddress: true,
      formattedAddr: true,
      city: {
        select: { name: true },
      },
    },
  });

  if (!place) {
    console.log("❌ Place not found");
    process.exit(1);
  }

  console.log("📍 Place found:");
  console.log(`   Title: ${place.title}`);
  console.log(`   Status: ${place.status}`);
  console.log(`   City: ${place.city?.name || "(none)"}`);
  console.log(`   Current slug: ${place.slug || "(none)"}`);
  console.log();

  if (place.status !== "PUBLISHED") {
    console.log("⚠️  Place is not published yet");
    console.log("   Slug will be assigned automatically when place is published");
    process.exit(0);
  }

  if (place.slug) {
    console.log("⚠️  Place already has a slug");
    console.log(`   Current: /places/${place.slug}`);
    console.log();
    
    const answer = await new Promise<string>((resolve) => {
      process.stdout.write("   Regenerate slug? (y/N): ");
      process.stdin.once("data", (data) => {
        resolve(data.toString().trim().toLowerCase());
      });
    });

    if (answer !== "y" && answer !== "yes") {
      console.log("   Cancelled");
      process.exit(0);
    }
    console.log();
  }

  console.log("🚀 Assigning slug...\n");

  try {
    const newSlug = await assignSlugOnPublish(placeId);

    console.log("✅ Slug assigned successfully!");
    console.log(`   New slug: ${newSlug}`);
    console.log(`   URL: http://localhost:3000/places/${newSlug}`);
    console.log();

    // Check if old slug was saved to history
    if (place.slug && place.slug !== newSlug) {
      console.log("📜 Old slug saved to history:");
      console.log(`   ${place.slug} → redirects to ${newSlug}`);
      console.log();
    }

    // Check for duplicates that were recalculated
    const duplicates = await prisma.place.findMany({
      where: {
        cityId: place.cityId,
        status: "PUBLISHED",
        archivedAt: null,
        id: { not: placeId },
      },
      select: {
        id: true,
        title: true,
        slug: true,
      },
    });

    const normalizedTitle = place.title.trim().toLowerCase();
    const sameName = duplicates.filter(
      (d) => d.title.trim().toLowerCase() === normalizedTitle
    );

    if (sameName.length > 0) {
      console.log(`ℹ️  Found ${sameName.length} other place(s) with same name:`);
      for (const dup of sameName) {
        console.log(`   - ${dup.title}: /places/${dup.slug}`);
      }
      console.log();
      console.log("   All duplicate slugs have been recalculated");
    }
  } catch (error) {
    console.error("❌ Error assigning slug:", error);
    process.exit(1);
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
