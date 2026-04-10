/**
 * Test the location service directly
 */

import { updatePlaceLocation } from "../../src/services/place/placeLocation.service";
import prisma from "../../src/lib/prisma";

async function testLocationService() {
  console.log("🧪 Testing location service...\n");

  try {
    // Find a test place
    const place = await prisma.place.findFirst({
      select: { id: true, title: true },
    });

    if (!place) {
      console.log("❌ No place found for testing");
      return;
    }

    console.log(`Testing with place: ${place.title} (${place.id})\n`);

    // Test with simple coordinates
    const result = await updatePlaceLocation(place.id, {
      lat: 53.9045,
      lng: 27.5615,
      formattedAddr: "Test address",
    });

    console.log("✅ Service test passed!");
    console.log("Result:", JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("❌ Service test failed:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testLocationService();
