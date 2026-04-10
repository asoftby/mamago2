/**
 * Check if City table has coordinates populated
 */

import prisma from "../../src/lib/prisma";

async function main() {
  console.log("Checking City coordinates...\n");

  const cities = await prisma.city.findMany({
    select: {
      name: true,
      slug: true,
      centerLat: true,
      centerLng: true,
      radiusKm: true,
      googleName: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${cities.length} cities:\n`);

  for (const city of cities) {
    const hasCoords = city.centerLat && city.centerLng && city.radiusKm;
    const status = hasCoords ? "✅" : "❌";
    console.log(`${status} ${city.name} (${city.slug})`);
    console.log(`   Center: ${city.centerLat || "null"}, ${city.centerLng || "null"}`);
    console.log(`   Radius: ${city.radiusKm || "null"} km`);
    console.log(`   Google: ${city.googleName || "null"}`);
    console.log();
  }

  // Check specifically for Minsk
  const minsk = cities.find((c) => c.slug === "minsk");
  if (minsk) {
    console.log("\n=== MINSK STATUS ===");
    if (minsk.centerLat && minsk.centerLng && minsk.radiusKm) {
      console.log("✅ Minsk has coordinates configured");
      console.log(`   Center: ${minsk.centerLat}, ${minsk.centerLng}`);
      console.log(`   Radius: ${minsk.radiusKm} km`);
    } else {
      console.log("❌ Minsk is missing coordinates!");
      console.log("   Run: npm run db:seed-city-coords");
    }
  } else {
    console.log("\n❌ Minsk city not found in database!");
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
