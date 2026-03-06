/**
 * End-to-end test for Place geo enrichment pipeline
 * Simulates the full flow: Create Place → Update Location → Verify cityId
 */

import prisma from "../src/lib/prisma";
import { updatePlaceLocation } from "../src/services/place/placeLocation.service";

async function main() {
  console.log("=== E2E TEST: PLACE GEO ENRICHMENT ===\n");

  // Find a test user (BUSINESS_OWNER)
  let testUser = await prisma.user.findFirst({
    where: { role: "BUSINESS_OWNER" },
  });

  if (!testUser) {
    console.log("Creating test BUSINESS_OWNER user...");
    testUser = await prisma.user.create({
      data: {
        email: `test-geo-${Date.now()}@example.com`,
        passwordHash: "dummy",
        role: "BUSINESS_OWNER",
      },
    });
    console.log(`✅ Created test user: ${testUser.id}\n`);
  } else {
    console.log(`✅ Using existing test user: ${testUser.id}\n`);
  }

  // Test Case 1: Create place with Minsk address
  console.log("Test Case 1: Create Place with Minsk address");
  console.log("Address: ул. Мястровская 5, Минск");
  console.log("Coordinates: 53.9006, 27.559\n");

  const place1 = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Test Place - Minsk",
      category: "cafe",
      shortDesc: "Test place for geo enrichment",
      status: "DRAFT",
      createRequestId: `test-${Date.now()}-1`,
    },
  });

  console.log(`✅ Created place: ${place1.id}`);
  console.log(`   Initial cityId: ${place1.cityId || "null"}\n`);

  // Update location with Google address data
  console.log("Running geo enrichment...");
  const enrichedPlace1 = await updatePlaceLocation(place1.id, {
    lat: 53.9006,
    lng: 27.559,
    googlePlaceId: "ChIJl2HKCjaP20YRQEQvCy_c4Xw",
    formattedAddr: "ул. Мястровская 5, Минск, Belarus",
    addressJson: [
      {
        long_name: "5",
        short_name: "5",
        types: ["street_number"],
      },
      {
        long_name: "Мястровская вуліца",
        short_name: "Мястровская вуліца",
        types: ["route"],
      },
      {
        long_name: "Minsk",
        short_name: "Minsk",
        types: ["locality", "political"],
      },
      {
        long_name: "Minsk Region",
        short_name: "Minsk Region",
        types: ["administrative_area_level_1", "political"],
      },
      {
        long_name: "Belarus",
        short_name: "BY",
        types: ["country", "political"],
      },
    ],
  });

  console.log("\n✅ Geo enrichment complete!");
  console.log(`   cityId: ${enrichedPlace1?.cityId || "null"}`);
  console.log(`   city: ${enrichedPlace1?.city?.name || "null"}`);
  console.log(`   districtAutoId: ${enrichedPlace1?.districtAutoId || "null"}`);
  console.log(`   metroAutoId: ${enrichedPlace1?.metroAutoId || "null"}`);

  if (enrichedPlace1?.cityId) {
    console.log("\n✅ TEST PASSED: cityId resolved successfully!");
  } else {
    console.log("\n❌ TEST FAILED: cityId is still null!");
  }

  // Test Case 2: Manual pin (no address)
  console.log("\n\nTest Case 2: Create Place with manual pin (no address)");
  console.log("Coordinates: 53.9, 27.5 (Minsk center)\n");

  const place2 = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Test Place - Manual Pin",
      category: "park",
      shortDesc: "Test place with manual pin",
      status: "DRAFT",
      createRequestId: `test-${Date.now()}-2`,
    },
  });

  console.log(`✅ Created place: ${place2.id}`);
  console.log(`   Initial cityId: ${place2.cityId || "null"}\n`);

  console.log("Running geo enrichment...");
  const enrichedPlace2 = await updatePlaceLocation(place2.id, {
    lat: 53.9,
    lng: 27.5,
    formattedAddr: "Minsk, Belarus",
  });

  console.log("\n✅ Geo enrichment complete!");
  console.log(`   cityId: ${enrichedPlace2?.cityId || "null"}`);
  console.log(`   city: ${enrichedPlace2?.city?.name || "null"}`);

  if (enrichedPlace2?.cityId) {
    console.log("\n✅ TEST PASSED: cityId resolved from coordinates!");
  } else {
    console.log("\n❌ TEST FAILED: cityId is still null!");
  }

  // Cleanup
  console.log("\n\nCleaning up test data...");
  await prisma.place.deleteMany({
    where: {
      id: { in: [place1.id, place2.id] },
    },
  });
  console.log("✅ Cleanup complete");

  // Summary
  console.log("\n=== SUMMARY ===");
  const passed = [enrichedPlace1?.cityId, enrichedPlace2?.cityId].filter(Boolean).length;
  console.log(`Passed: ${passed}/2 tests`);
  
  if (passed === 2) {
    console.log("✅ All E2E tests passed!");
  } else {
    console.log("❌ Some E2E tests failed");
    process.exit(1);
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
