#!/usr/bin/env tsx

/**
 * Create basic cities for the application
 */

import { prisma } from "../../src/lib/prisma";

async function createBasicCities() {
  console.log("🏙️ Creating basic cities");
  
  try {
    const belarus = await prisma.country.findUnique({ where: { slug: "belarus" } });
    if (!belarus) throw new Error("Country belarus not found — run geo migration first");

    const minsk = await prisma.city.upsert({
      where: { countryId_slug: { countryId: belarus.id, slug: "minsk" } },
      update: {
        name: "Минск",
        centerLat: 53.9,
        centerLng: 27.5,
        radiusKm: 40,
        googleName: "Minsk",
      },
      create: {
        countryId: belarus.id,
        slug: "minsk",
        name: "Минск",
        centerLat: 53.9,
        centerLng: 27.5,
        radiusKm: 40,
        googleName: "Minsk",
      },
    });
    
    console.log(`✅ Created/Updated Minsk: ${minsk.id}`);
    
    // Create some basic districts for Minsk
    const districts = [
      "Центральный",
      "Советский", 
      "Партизанский",
      "Заводской",
      "Ленинский",
      "Октябрьский",
      "Первомайский",
      "Московский",
      "Фрунзенский",
    ];
    
    for (const districtName of districts) {
      await prisma.district.upsert({
        where: { 
          cityId_name: { 
            cityId: minsk.id, 
            name: districtName 
          } 
        },
        update: {},
        create: {
          name: districtName,
          cityId: minsk.id,
        },
      });
    }
    
    console.log(`✅ Created ${districts.length} districts for Minsk`);
    
    // Create some basic metro stations for Minsk
    const metroStations = [
      { name: "Купаловская", lat: 53.9045, lng: 27.5615 },
      { name: "Немига", lat: 53.9017, lng: 27.5549 },
      { name: "Фрунзенская", lat: 53.8986, lng: 27.5481 },
      { name: "Молодёжная", lat: 53.8955, lng: 27.5413 },
      { name: "Пушкинская", lat: 53.8924, lng: 27.5345 },
      { name: "Октябрьская", lat: 53.8893, lng: 27.5277 },
      { name: "Площадь Победы", lat: 53.8862, lng: 27.5209 },
      { name: "Площадь Якуба Коласа", lat: 53.8831, lng: 27.5141 },
      { name: "Академия наук", lat: 53.8800, lng: 27.5073 },
      { name: "Парк Челюскинцев", lat: 53.8769, lng: 27.5005 },
    ];
    
    for (const station of metroStations) {
      await prisma.metroStation.upsert({
        where: { 
          cityId_name: { 
            cityId: minsk.id, 
            name: station.name 
          } 
        },
        update: {},
        create: {
          name: station.name,
          cityId: minsk.id,
          lat: station.lat,
          lng: station.lng,
          osmType: "node",
          osmId: `minsk-${station.name.toLowerCase().replace(/\s+/g, '-')}`,
        },
      });
    }
    
    console.log(`✅ Created ${metroStations.length} metro stations for Minsk`);
    
    // Verify creation
    const cityCount = await prisma.city.count();
    const districtCount = await prisma.district.count();
    const metroCount = await prisma.metroStation.count();
    
    console.log(`\n🎉 Database ready:`);
    console.log(`   - ${cityCount} cities`);
    console.log(`   - ${districtCount} districts`);
    console.log(`   - ${metroCount} metro stations`);
    
  } catch (error) {
    console.error("❌ Error creating cities:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createBasicCities();