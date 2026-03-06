/**
 * Test script to verify Prisma client includes geo enrichment fields
 * Run: npx tsx scripts/test-prisma-geo-fields.ts
 */

import prisma from "../src/lib/prisma";

async function testPrismaGeoFields() {
  console.log("🔍 Testing Prisma client geo fields...\n");

  try {
    // Test 1: Check if we can select geo fields
    console.log("Test 1: Selecting geo fields from Place model...");
    const place = await prisma.place.findFirst({
      select: {
        id: true,
        title: true,
        districtAutoId: true,
        districtManualId: true,
        metroAutoId: true,
        metroAutoDistanceM: true,
        metroManualId: true,
        metroManualDistanceM: true,
      },
    });

    if (place) {
      console.log("✅ Successfully selected geo fields");
      console.log("Place:", {
        id: place.id,
        title: place.title,
        districtAutoId: place.districtAutoId || "null",
        districtManualId: place.districtManualId || "null",
        metroAutoId: place.metroAutoId || "null",
        metroAutoDistanceM: place.metroAutoDistanceM || "null",
        metroManualId: place.metroManualId || "null",
        metroManualDistanceM: place.metroManualDistanceM || "null",
      });
    } else {
      console.log("⚠️ No places found in database");
    }

    // Test 2: Check if we can include relations
    console.log("\nTest 2: Including geo relations...");
    const placeWithRelations = await prisma.place.findFirst({
      select: {
        id: true,
        title: true,
        districtAuto: {
          select: {
            id: true,
            name: true,
          },
        },
        districtManual: {
          select: {
            id: true,
            name: true,
          },
        },
        metroAuto: {
          select: {
            id: true,
            name: true,
          },
        },
        metroManual: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (placeWithRelations) {
      console.log("✅ Successfully included geo relations");
      console.log("Place with relations:", {
        id: placeWithRelations.id,
        title: placeWithRelations.title,
        districtAuto: placeWithRelations.districtAuto?.name || "null",
        districtManual: placeWithRelations.districtManual?.name || "null",
        metroAuto: placeWithRelations.metroAuto?.name || "null",
        metroManual: placeWithRelations.metroManual?.name || "null",
      });
    }

    console.log("\n✅ All tests passed! Prisma client is up to date.");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaGeoFields();
