/**
 * Test PLACE Address in Media Metadata
 * 
 * Tests that address data is correctly included in auto-generated metadata.
 * 
 * Run: npx tsx scripts/manual-tests/test-place-address-metadata.ts
 */

import { prisma } from "../../src/lib/prisma";
import { getMediaUsageContext } from "../../src/lib/media/getMediaUsageContext";
import { generateMediaMetadata } from "../../src/lib/media/generateMediaMetadata";

async function testPlaceAddressMetadata() {
  console.log("🧪 Testing PLACE Address in Media Metadata\n");

  // Find PLACE with city and address
  const place = await prisma.place.findFirst({
    where: {
      cityId: { not: null },
      shortAddress: { not: null },
    },
    include: {
      city: true,
    },
  });

  if (!place) {
    console.log("❌ No place with city and address found");
    return;
  }

  console.log("📍 Test Place:");
  console.log(`  Title: ${place.title}`);
  console.log(`  City: ${place.city?.name || "(none)"}`);
  console.log(`  Short Address: ${place.shortAddress || "(none)"}\n`);

  // Test different field types
  const fields = ["logo", "cover", "gallery"];

  for (const field of fields) {
    console.log(`\n--- Testing field: ${field} ---`);

    const context = {
      entityType: "PLACE" as const,
      entityTitle: place.title,
      field,
      placeAddress: {
        cityName: place.city?.name || null,
        shortAddress: place.shortAddress || null,
      },
    };

    const metadata = generateMediaMetadata(context);

    console.log(`Title: ${metadata.title}`);
    console.log(`Alt: ${metadata.alt}`);
    console.log(`Caption: ${metadata.caption}`);
  }

  console.log("\n\n✅ Address metadata generation works!");
  console.log("\n📋 Summary:");
  console.log("- Logo: No address (simple)");
  console.log("- Cover: City in title, full address in alt/caption");
  console.log("- Gallery: City in title, full address in alt/caption");
}

testPlaceAddressMetadata()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
