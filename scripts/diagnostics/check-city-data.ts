#!/usr/bin/env tsx

/**
 * Check City Data in Database
 * Verifies what cities, districts, and metro stations exist
 */

import prisma from "../../src/lib/prisma.js";

async function checkCityData() {
  console.log("🔍 Checking City Data in Database\n");

  try {
    // Check cities
    console.log("1. Cities in database:");
    const cities = await prisma.city.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        hasMetro: true,
        _count: {
          select: {
            districts: true,
            metroStations: true,
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    if (cities.length === 0) {
      console.log("❌ No cities found in database!");
      return;
    }

    cities.forEach(city => {
      console.log(`   ${city.name} (${city.slug}) - ID: ${city.id}`);
      console.log(`      Districts: ${city._count.districts}, Metro: ${city._count.metroStations}, HasMetro: ${city.hasMetro}`);
    });

    // Check for Minsk specifically
    console.log("\n2. Checking for Minsk:");
    const minsk = await prisma.city.findFirst({
      where: {
        OR: [
          { slug: "minsk" },
          { slug: "минск" },
          { name: { contains: "Минск", mode: "insensitive" } },
          { name: { contains: "Minsk", mode: "insensitive" } }
        ]
      },
      include: {
        _count: {
          select: {
            districts: true,
            metroStations: true,
          }
        }
      }
    });

    if (minsk) {
      console.log(`✅ Found Minsk: ${minsk.name} (${minsk.slug}) - ID: ${minsk.id}`);
      console.log(`   Districts: ${minsk._count.districts}, Metro: ${minsk._count.metroStations}`);
      console.log(`   HasMetro: ${minsk.hasMetro}, MetroMaxDistance: ${minsk.metroMaxDistanceM}m`);
    } else {
      console.log("❌ Minsk not found in database!");
    }

    // Check districts for first city
    if (cities.length > 0) {
      const firstCity = cities[0];
      console.log(`\n3. Districts for ${firstCity.name}:`);
      const districts = await prisma.district.findMany({
        where: { cityId: firstCity.id },
        select: { id: true, name: true },
        take: 5
      });
      
      districts.forEach(district => {
        console.log(`   ${district.name} (${district.id})`);
      });
      
      if (districts.length === 0) {
        console.log("   No districts found");
      }
    }

    // Check metro stations for first city
    if (cities.length > 0) {
      const firstCity = cities[0];
      console.log(`\n4. Metro stations for ${firstCity.name}:`);
      const stations = await prisma.metroStation.findMany({
        where: { cityId: firstCity.id },
        select: { id: true, name: true },
        take: 5
      });
      
      stations.forEach(station => {
        console.log(`   ${station.name} (${station.id})`);
      });
      
      if (stations.length === 0) {
        console.log("   No metro stations found");
      }
    }

  } catch (error) {
    console.error("❌ Database error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCityData().catch(console.error);