/**
 * Seed District Centroids for Minsk
 * 
 * MVP implementation: Approximate centroids for 9 Minsk districts
 * These coordinates are approximate and can be refined later with actual polygon data
 * 
 * Usage: npx tsx prisma/seed/district-centroids.ts
 */

import prisma from "../../src/lib/prisma";

// Minsk district centroids (approximate)
const MINSK_DISTRICT_CENTROIDS = [
  {
    name: "Центральный",
    centerLat: 53.9006,
    centerLng: 27.5590,
  },
  {
    name: "Советский",
    centerLat: 53.9200,
    centerLng: 27.6100,
  },
  {
    name: "Первомайский",
    centerLat: 53.8900,
    centerLng: 27.6200,
  },
  {
    name: "Партизанский",
    centerLat: 53.8700,
    centerLng: 27.6400,
  },
  {
    name: "Заводской",
    centerLat: 53.8800,
    centerLng: 27.4800,
  },
  {
    name: "Ленинский",
    centerLat: 53.8500,
    centerLng: 27.5300,
  },
  {
    name: "Октябрьский",
    centerLat: 53.9100,
    centerLng: 27.4800,
  },
  {
    name: "Московский",
    centerLat: 53.9400,
    centerLng: 27.6700,
  },
  {
    name: "Фрунзенский",
    centerLat: 53.8500,
    centerLng: 27.6000,
  },
];

async function seedDistrictCentroids() {
  console.log("🌍 Seeding district centroids for Minsk...\n");

  try {
    // Find Minsk city
    const minsk = await prisma.city.findFirst({
      where: {
        OR: [
          { slug: "minsk" },
          { name: { contains: "Минск", mode: "insensitive" } },
          { name: { contains: "Minsk", mode: "insensitive" } },
        ],
      },
    });

    if (!minsk) {
      console.error("❌ Minsk city not found in database");
      console.log("   Please create Minsk city first");
      return;
    }

    console.log(`✅ Found Minsk: ${minsk.name} (${minsk.id})\n`);

    // Update each district with centroid
    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const districtData of MINSK_DISTRICT_CENTROIDS) {
      try {
        // Check if district exists
        const existing = await prisma.district.findFirst({
          where: {
            cityId: minsk.id,
            name: districtData.name,
          },
        });

        if (existing) {
          // Update existing district with centroid
          await prisma.district.update({
            where: { id: existing.id },
            data: {
              centerLat: districtData.centerLat,
              centerLng: districtData.centerLng,
            },
          });
          console.log(`✅ Updated: ${districtData.name} (${districtData.centerLat}, ${districtData.centerLng})`);
          updated++;
        } else {
          // Create new district with centroid
          await prisma.district.create({
            data: {
              cityId: minsk.id,
              name: districtData.name,
              centerLat: districtData.centerLat,
              centerLng: districtData.centerLng,
            },
          });
          console.log(`✅ Created: ${districtData.name} (${districtData.centerLat}, ${districtData.centerLng})`);
          created++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${districtData.name}:`, error);
        skipped++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${MINSK_DISTRICT_CENTROIDS.length}`);

    // Verify
    const districtsWithCentroids = await prisma.district.count({
      where: {
        cityId: minsk.id,
        centerLat: { not: null },
        centerLng: { not: null },
      },
    });

    console.log(`\n✅ Districts with centroids: ${districtsWithCentroids}/${MINSK_DISTRICT_CENTROIDS.length}`);

  } catch (error) {
    console.error("❌ Error seeding district centroids:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDistrictCentroids();
