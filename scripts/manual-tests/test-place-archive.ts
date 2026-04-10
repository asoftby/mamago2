/**
 * Test script for Place Archive/Unarchive functionality
 * 
 * Tests:
 * 1. Archive a place
 * 2. Verify archived place is hidden from active list
 * 3. Verify archived place appears in archived list
 * 4. Unarchive a place
 * 5. Verify unarchived place returns to active list
 */

import prisma from "../../src/lib/prisma";

async function testPlaceArchive() {
  console.log("🧪 Testing Place Archive System\n");

  try {
    // Find a test business owner
    const businessOwner = await prisma.user.findFirst({
      where: {
        role: "BUSINESS_OWNER",
        business: { isNot: null },
      },
      include: {
        business: true,
      },
    });

    if (!businessOwner) {
      console.log("❌ No business owner found. Please create one first.");
      return;
    }

    console.log(`✅ Found business owner: ${businessOwner.email}`);

    // Find or create a test place
    let testPlace = await prisma.place.findFirst({
      where: {
        ownerUserId: businessOwner.id,
        status: "PUBLISHED",
        archivedAt: null,
      },
    });

    if (!testPlace) {
      console.log("📝 Creating test place...");
      testPlace = await prisma.place.create({
        data: {
          ownerUserId: businessOwner.id,
          title: "Test Place for Archive",
          category: "cafe",
          shortDesc: "Test place for archive functionality",
          status: "PUBLISHED",
          locationSource: "MANUAL",
        },
      });
      console.log(`✅ Created test place: ${testPlace.title}`);
    } else {
      console.log(`✅ Found existing test place: ${testPlace.title}`);
    }

    // Test 1: Archive the place
    console.log("\n📦 Test 1: Archiving place...");
    const archivedPlace = await prisma.place.update({
      where: { id: testPlace.id },
      data: {
        archivedAt: new Date(),
        archivedByUserId: businessOwner.id,
      },
    });
    console.log(`✅ Place archived at: ${archivedPlace.archivedAt}`);

    // Test 2: Verify archived place is NOT in active list
    console.log("\n🔍 Test 2: Checking active places list...");
    const activePlaces = await prisma.place.findMany({
      where: {
        ownerUserId: businessOwner.id,
        archivedAt: null,
      },
    });
    const isInActiveList = activePlaces.some(p => p.id === testPlace.id);
    if (!isInActiveList) {
      console.log("✅ Archived place is NOT in active list (correct)");
    } else {
      console.log("❌ Archived place is still in active list (incorrect)");
    }

    // Test 3: Verify archived place IS in archived list
    console.log("\n🔍 Test 3: Checking archived places list...");
    const archivedPlaces = await prisma.place.findMany({
      where: {
        ownerUserId: businessOwner.id,
        archivedAt: { not: null },
      },
    });
    const isInArchivedList = archivedPlaces.some(p => p.id === testPlace.id);
    if (isInArchivedList) {
      console.log("✅ Archived place IS in archived list (correct)");
    } else {
      console.log("❌ Archived place is NOT in archived list (incorrect)");
    }

    // Test 4: Unarchive the place
    console.log("\n📤 Test 4: Unarchiving place...");
    const unarchivedPlace = await prisma.place.update({
      where: { id: testPlace.id },
      data: {
        archivedAt: null,
        archivedByUserId: null,
      },
    });
    console.log(`✅ Place unarchived (archivedAt: ${unarchivedPlace.archivedAt})`);

    // Test 5: Verify unarchived place is back in active list
    console.log("\n🔍 Test 5: Checking active places list after unarchive...");
    const activePlacesAfter = await prisma.place.findMany({
      where: {
        ownerUserId: businessOwner.id,
        archivedAt: null,
      },
    });
    const isBackInActiveList = activePlacesAfter.some(p => p.id === testPlace.id);
    if (isBackInActiveList) {
      console.log("✅ Unarchived place IS back in active list (correct)");
    } else {
      console.log("❌ Unarchived place is NOT in active list (incorrect)");
    }

    // Test 6: Verify status is unchanged
    console.log("\n🔍 Test 6: Verifying status unchanged...");
    const finalPlace = await prisma.place.findUnique({
      where: { id: testPlace.id },
    });
    if (finalPlace?.status === testPlace.status) {
      console.log(`✅ Status unchanged: ${finalPlace.status} (correct)`);
    } else {
      console.log(`❌ Status changed from ${testPlace.status} to ${finalPlace?.status} (incorrect)`);
    }

    console.log("\n✅ All tests completed!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testPlaceArchive();
