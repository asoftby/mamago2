/**
 * Seed City Configuration
 * 
 * Configures cities with:
 * - Google name for matching
 * - Center coordinates for resolution
 * - Metro configuration (hasMetro, metroMaxDistanceM)
 * 
 * Usage: npx tsx prisma/seed/city-configuration.ts
 */

import prisma from "../../src/lib/prisma";

const CITY_CONFIGS = [
  {
    slug: "minsk",
    name: "Минск",
    googleName: "Minsk",
    googleNames: ["Minsk", "Минск", "Мінск"],
    centerLat: 53.9006,
    centerLng: 27.5590,
    hasMetro: true,
    metroMaxDistanceM: 2500, // 2.5km threshold for Minsk
  },
  // Add other cities as needed
  // {
  //   slug: "mogilev",
  //   name: "Могилёв",
  //   googleName: "Mogilev",
  //   googleNames: ["Mogilev", "Могилёв", "Магілёў"],
  //   centerLat: 53.9007,
  //   centerLng: 30.3313,
  //   hasMetro: false,
  //   metroMaxDistanceM: null,
  // },
];

async function seedCityConfiguration() {
  console.log("🌍 Seeding city configuration...\n");

  try {
    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const config of CITY_CONFIGS) {
      try {
        // Check if city exists
        const existing = await prisma.city.findUnique({
          where: { slug: config.slug },
        });

        if (existing) {
          // Update existing city
          await prisma.city.update({
            where: { slug: config.slug },
            data: {
              googleName: config.googleName,
              googleNames: config.googleNames,
              centerLat: config.centerLat,
              centerLng: config.centerLng,
              hasMetro: config.hasMetro,
              metroMaxDistanceM: config.metroMaxDistanceM,
            },
          });
          console.log(`✅ Updated: ${config.name} (${config.slug})`);
          console.log(`   Google name: ${config.googleName}`);
          console.log(`   Center: ${config.centerLat}, ${config.centerLng}`);
          console.log(`   Metro: ${config.hasMetro ? `Yes (max ${config.metroMaxDistanceM}m)` : "No"}\n`);
          updated++;
        } else {
          // Create new city
          await prisma.city.create({
            data: {
              slug: config.slug,
              name: config.name,
              googleName: config.googleName,
              googleNames: config.googleNames,
              centerLat: config.centerLat,
              centerLng: config.centerLng,
              hasMetro: config.hasMetro,
              metroMaxDistanceM: config.metroMaxDistanceM,
            },
          });
          console.log(`✅ Created: ${config.name} (${config.slug})`);
          console.log(`   Google name: ${config.googleName}`);
          console.log(`   Center: ${config.centerLat}, ${config.centerLng}`);
          console.log(`   Metro: ${config.hasMetro ? `Yes (max ${config.metroMaxDistanceM}m)` : "No"}\n`);
          created++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${config.name}:`, error);
        skipped++;
      }
    }

    console.log(`📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${CITY_CONFIGS.length}\n`);

    // Verify
    const citiesWithConfig = await prisma.city.count({
      where: {
        googleName: { not: null },
        centerLat: { not: null },
        centerLng: { not: null },
      },
    });

    console.log(`✅ Cities with full configuration: ${citiesWithConfig}`);

  } catch (error) {
    console.error("❌ Error seeding city configuration:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCityConfiguration();
