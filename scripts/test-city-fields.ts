/**
 * Test script to verify City model has new fields
 */

import prisma from "../src/lib/prisma";

async function testCityFields() {
  console.log("🧪 Testing City model fields...\n");

  try {
    const city = await prisma.city.findFirst({
      where: { slug: "minsk" },
      select: {
        id: true,
        name: true,
        slug: true,
        googleName: true,
        googleNames: true,
        centerLat: true,
        centerLng: true,
        hasMetro: true,
        metroMaxDistanceM: true,
      },
    });

    if (!city) {
      console.log("❌ Minsk city not found");
      return;
    }

    console.log("✅ City fields test passed:");
    console.log(JSON.stringify(city, null, 2));

  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testCityFields();
