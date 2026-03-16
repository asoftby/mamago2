#!/usr/bin/env tsx

/**
 * Check cities in database
 */

import { prisma } from "../src/lib/prisma";

async function checkCities() {
  console.log("🏙️ Checking cities in database");
  
  try {
    const cities = await prisma.city.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            districts: true,
            metroStations: true,
          }
        }
      },
      orderBy: { name: "asc" }
    });
    
    console.log(`Found ${cities.length} cities:`);
    
    cities.forEach(city => {
      console.log(`- ${city.name} (${city.slug}): ${city._count.districts} districts, ${city._count.metroStations} metro stations`);
    });
    
    if (cities.length === 0) {
      console.log("❌ No cities found in database");
    }
    
  } catch (error) {
    console.error("❌ Error checking cities:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCities();