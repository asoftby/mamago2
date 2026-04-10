/**
 * E2E Test: Place Creation with City Resolution
 * 
 * Simulates the full wizard flow:
 * 1. User fills Step 1 (profile)
 * 2. User selects Minsk address in Step 2
 * 3. User saves draft
 * 4. Verify cityId is resolved and geo enrichment runs
 */

import prisma from "../../src/lib/prisma";

// Sample data from Google Places API for "ул. Мястровская 5, Минск"
const testData = {
  // Step 1
  title: "Test Place - City Resolution",
  category: "cafe",
  shortDesc: "Testing city resolution",
  
  // Step 2 - Google autocomplete data
  lat: 53.9045,
  lng: 27.5615,
  googlePlaceId: "ChIJTest123",
  formattedAddr: "вуліца Мястроўская 5, Мінск, Беларусь",
  addressJson: [
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
  ],
};

async function main() {
  console.log("=".repeat(80));
  console.log("E2E TEST: Place Creation with City Resolution");
  console.log("=".repeat(80));
  console.log();

  // Get test user
  const user = await prisma.user.findFirst({
    where: { role: "BUSINESS_OWNER" },
  });

  if (!user) {
    console.error("❌ No BUSINESS_OWNER user found. Please create one first.");
    process.exit(1);
  }

  console.log(`✅ Using test user: ${user.email} (${user.id})`);
  console.log();

  // Clean up any existing test places
  await prisma.place.deleteMany({
    where: {
      ownerUserId: user.id,
      title: testData.title,
    },
  });

  console.log("Step 1: Creating Place with location data...");
  console.log("-".repeat(80));
  console.log("Location data:");
  console.log(`  lat: ${testData.lat}`);
  console.log(`  lng: ${testData.lng}`);
  console.log(`  googlePlaceId: ${testData.googlePlaceId}`);
  console.log(`  formattedAddr: ${testData.formattedAddr}`);
  console.log(`  addressJson: ${testData.addressJson.length} components`);
  
  const locality = testData.addressJson.find((c) => c.types.includes("locality"));
  const country = testData.addressJson.find((c) => c.types.includes("country"));
  console.log(`  Extracted locality: ${locality?.long_name}`);
  console.log(`  Extracted country: ${country?.short_name}`);
  console.log();

  // Simulate API call: POST /api/business/places
  const place = await prisma.place.create({
    data: {
      ownerUserId: user.id,
      createRequestId: `test-${Date.now()}`,
      status: "DRAFT",
      
      // Step 1
      title: testData.title,
      category: testData.category,
      shortDesc: testData.shortDesc,
      
      // Step 2
      lat: testData.lat,
      lng: testData.lng,
      googlePlaceId: testData.googlePlaceId,
      formattedAddr: testData.formattedAddr,
      addressJson: testData.addressJson,
      locationSource: "GOOGLE",
    },
  });

  console.log(`✅ Place created: ${place.id}`);
  console.log(`   Initial cityId: ${place.cityId || "NULL"}`);
  console.log();

  // Simulate geo enrichment (what happens in POST /api/business/places)
  console.log("Step 2: Running geo enrichment...");
  console.log("-".repeat(80));

  const { updatePlaceLocation } = await import("../../src/services/place/placeLocation.service");
  
  const enrichedPlace = await updatePlaceLocation(place.id, {
    lat: testData.lat,
    lng: testData.lng,
    googlePlaceId: testData.googlePlaceId,
    formattedAddr: testData.formattedAddr,
    addressJson: testData.addressJson,
  });

  console.log();
  console.log("Step 3: Verifying results...");
  console.log("-".repeat(80));

  if (!enrichedPlace) {
    console.error("❌ Geo enrichment returned null");
    process.exit(1);
  }

  console.log("Enriched place data:");
  console.log(`  cityId: ${enrichedPlace.cityId || "NULL"}`);
  console.log(`  city: ${enrichedPlace.city?.name || "NULL"}`);
  console.log(`  districtAutoId: ${enrichedPlace.districtAutoId || "NULL"}`);
  console.log(`  metroAutoId: ${enrichedPlace.metroAutoId || "NULL"}`);
  console.log(`  metroAutoDistanceM: ${enrichedPlace.metroAutoDistanceM || "NULL"}`);
  console.log();

  // Verify expectations
  const errors: string[] = [];

  if (!enrichedPlace.cityId) {
    errors.push("❌ cityId is NULL (expected Minsk city ID)");
  } else {
    console.log("✅ cityId resolved");
  }

  if (!enrichedPlace.city) {
    errors.push("❌ city relation is NULL");
  } else {
    console.log(`✅ city relation loaded: ${enrichedPlace.city.name}`);
  }

  if (!enrichedPlace.districtAutoId) {
    errors.push("⚠️  districtAutoId is NULL (may be expected if no district polygons)");
  } else {
    console.log(`✅ districtAutoId resolved`);
  }

  if (!enrichedPlace.metroAutoId) {
    errors.push("⚠️  metroAutoId is NULL (may be expected if far from metro)");
  } else {
    console.log(`✅ metroAutoId resolved`);
  }

  console.log();
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  if (errors.length === 0) {
    console.log("✅ ALL CHECKS PASSED");
  } else {
    console.log("Issues found:");
    errors.forEach((error) => console.log(`  ${error}`));
  }

  console.log();
  console.log("Test place ID:", place.id);
  console.log("You can view it at: /business/places/" + place.id + "/edit");
  console.log();

  // Clean up
  console.log("Cleaning up test data...");
  await prisma.place.delete({ where: { id: place.id } });
  console.log("✅ Test place deleted");
  console.log();
}

main()
  .catch((error) => {
    console.error("Test error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
