/**
 * Seed City coordinates for coordinate-based resolution
 */

import prisma from "../src/lib/prisma";

async function main() {
  console.log("Seeding City coordinates...\n");

  // Minsk (Belarus capital)
  const minsk = await prisma.city.update({
    where: { slug: "minsk" },
    data: {
      centerLat: 53.9,
      centerLng: 27.5,
      radiusKm: 40,
      googleName: "Minsk",
    },
  });
  console.log(`✅ Updated Minsk: center=(${minsk.centerLat}, ${minsk.centerLng}), radius=${minsk.radiusKm}km`);

  // Verify
  const cities = await prisma.city.findMany({
    where: {
      centerLat: { not: null },
      centerLng: { not: null },
      radiusKm: { not: null },
    },
    select: {
      name: true,
      centerLat: true,
      centerLng: true,
      radiusKm: true,
      googleName: true,
    },
  });

  console.log(`\n✅ ${cities.length} cities ready for coordinate-based resolution:`);
  cities.forEach((city) => {
    console.log(`   - ${city.name}: (${city.centerLat}, ${city.centerLng}), radius=${city.radiusKm}km`);
  });
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
