/**
 * Diagnostic Script: City Resolution Pipeline
 * 
 * Tests the full pipeline from Google address selection to cityId resolution
 * Identifies exactly where data is lost or processing fails
 */

import prisma from "../../src/lib/prisma";
import { resolveCityId } from "../../src/services/place/cityResolver.service";

// Sample Google address_components for "ул. Мястровская 5, Минск"
const sampleAddressComponents = [
  {
    long_name: "5",
    short_name: "5",
    types: ["street_number"]
  },
  {
    long_name: "вуліца Мястроўская",
    short_name: "вул. Мястроўская",
    types: ["route"]
  },
  {
    long_name: "Мінск",
    short_name: "Мінск",
    types: ["locality", "political"]
  },
  {
    long_name: "Мінская вобласць",
    short_name: "Мінская вобласць",
    types: ["administrative_area_level_1", "political"]
  },
  {
    long_name: "Беларусь",
    short_name: "BY",
    types: ["country", "political"]
  }
];

const sampleCoordinates = {
  lat: 53.9045,
  lng: 27.5615,
};

async function main() {
  console.log("=".repeat(80));
  console.log("DIAGNOSTIC: City Resolution Pipeline");
  console.log("=".repeat(80));
  console.log();

  // TEST 1: Check City table data
  console.log("TEST 1: Checking City table...");
  console.log("-".repeat(80));
  
  const cities = await prisma.city.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      googleName: true,
      centerLat: true,
      centerLng: true,
      radiusKm: true,
    },
  });

  console.log(`Found ${cities.length} cities in database:`);
  cities.forEach((city) => {
    console.log(`  - ${city.name} (${city.slug})`);
    console.log(`    googleName: ${city.googleName || "NULL"}`);
    console.log(`    center: ${city.centerLat}, ${city.centerLng}`);
    console.log(`    radius: ${city.radiusKm}km`);
    console.log(`    ✅ Ready: ${!!(city.centerLat && city.centerLng && city.radiusKm)}`);
  });
  console.log();

  // TEST 2: Test address_components parsing
  console.log("TEST 2: Testing address_components parsing...");
  console.log("-".repeat(80));
  console.log("Sample address_components:");
  console.log(JSON.stringify(sampleAddressComponents, null, 2));
  console.log();

  // Extract city name
  const cityComponent = sampleAddressComponents.find((c) =>
    c.types.includes("locality")
  );
  const countryComponent = sampleAddressComponents.find((c) =>
    c.types.includes("country")
  );

  console.log(`Extracted city name: "${cityComponent?.long_name || "NOT FOUND"}"`);
  console.log(`Extracted country code: "${countryComponent?.short_name || "NOT FOUND"}"`);
  console.log();

  // TEST 3: Test city lookup by name
  console.log("TEST 3: Testing city lookup by name...");
  console.log("-".repeat(80));
  
  if (cityComponent?.long_name) {
    const cityName = cityComponent.long_name;
    console.log(`Looking up city: "${cityName}"`);

    // Try exact match
    const exactMatch = await prisma.city.findFirst({
      where: {
        OR: [
          { name: { equals: cityName, mode: "insensitive" } },
          { googleName: { equals: cityName, mode: "insensitive" } },
          { slug: cityName.toLowerCase().replace(/\s+/g, "-") },
        ],
      },
    });

    if (exactMatch) {
      console.log(`✅ Found exact match: ${exactMatch.name} (${exactMatch.id})`);
    } else {
      console.log(`❌ No exact match found for "${cityName}"`);
      console.log(`   Trying variations...`);
      
      // Try "Minsk" (English)
      const englishMatch = await prisma.city.findFirst({
        where: {
          OR: [
            { name: { equals: "Minsk", mode: "insensitive" } },
            { googleName: { equals: "Minsk", mode: "insensitive" } },
          ],
        },
      });

      if (englishMatch) {
        console.log(`✅ Found English variant: ${englishMatch.name} (${englishMatch.id})`);
      } else {
        console.log(`❌ No English variant found`);
      }
    }
  }
  console.log();

  // TEST 4: Test coordinate-based resolution
  console.log("TEST 4: Testing coordinate-based resolution...");
  console.log("-".repeat(80));
  console.log(`Coordinates: ${sampleCoordinates.lat}, ${sampleCoordinates.lng}`);
  console.log();

  const result = await resolveCityId({
    lat: sampleCoordinates.lat,
    lng: sampleCoordinates.lng,
    addressJson: sampleAddressComponents,
  });

  console.log("Resolution result:");
  console.log(JSON.stringify(result, null, 2));
  console.log();

  // TEST 5: Summary and recommendations
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  if (result.cityId) {
    console.log("✅ SUCCESS: cityId resolved");
    console.log(`   cityId: ${result.cityId}`);
    console.log(`   cityName: ${result.cityName}`);
    console.log(`   confidence: ${result.confidence}`);
  } else {
    console.log("❌ FAILURE: cityId not resolved");
    console.log();
    console.log("Possible causes:");
    
    const minskCity = cities.find((c) => c.slug === "minsk");
    if (!minskCity) {
      console.log("  1. ❌ Minsk city not found in database");
    } else if (!minskCity.centerLat || !minskCity.centerLng || !minskCity.radiusKm) {
      console.log("  1. ❌ Minsk city missing coordinates or radius");
      console.log(`     centerLat: ${minskCity.centerLat || "NULL"}`);
      console.log(`     centerLng: ${minskCity.centerLng || "NULL"}`);
      console.log(`     radiusKm: ${minskCity.radiusKm || "NULL"}`);
    } else {
      console.log("  1. ✅ Minsk city has valid coordinates and radius");
    }

    if (!cityComponent) {
      console.log("  2. ❌ No locality found in address_components");
    } else {
      console.log(`  2. ✅ Locality found: "${cityComponent.long_name}"`);
      
      if (!minskCity?.googleName) {
        console.log(`  3. ❌ Minsk city missing googleName field`);
        console.log(`     Need to set googleName to match Google's format`);
      } else if (minskCity.googleName !== cityComponent.long_name) {
        console.log(`  3. ⚠️  googleName mismatch:`);
        console.log(`     Database: "${minskCity.googleName}"`);
        console.log(`     Google: "${cityComponent.long_name}"`);
      } else {
        console.log(`  3. ✅ googleName matches`);
      }
    }
  }

  console.log();
  console.log("=".repeat(80));
}

main()
  .catch((error) => {
    console.error("Diagnostic error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
