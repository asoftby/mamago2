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
import { DEFAULT_COUNTRY_SLUG } from "../../src/server/geo/geoConstants";

const CITY_CONFIGS = [
  {
    slug: "minsk",
    name: "Минск",
    googleName: "Minsk",
    googleNames: ["Minsk", "Минск", "Мінск"],
    centerLat: 53.9006,
    centerLng: 27.5590,
    hasMetro: true,
    metroMaxDistanceM: 2500,
  },
];

async function seedCityConfiguration() {
  console.log("🌍 Seeding city configuration...\n");

  try {
    const belarus = await prisma.country.findUnique({ where: { slug: DEFAULT_COUNTRY_SLUG } });
    if (!belarus) {
      console.error("❌ Country Belarus not found — run main seed / migration first");
      return;
    }

    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const config of CITY_CONFIGS) {
      try {
        const existing = await prisma.city.findUnique({
          where: { countryId_slug: { countryId: belarus.id, slug: config.slug } },
        });

        if (existing) {
          await prisma.city.update({
            where: { id: existing.id },
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
          updated++;
        } else {
          await prisma.city.create({
            data: {
              countryId: belarus.id,
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
          created++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${config.name}:`, error);
        skipped++;
      }
    }

    console.log(`📊 Summary: updated=${updated}, created=${created}, skipped=${skipped}`);
  } catch (error) {
    console.error("❌ Error seeding city configuration:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCityConfiguration();
