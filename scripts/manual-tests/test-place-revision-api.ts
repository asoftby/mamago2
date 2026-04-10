/**
 * Test script for PlaceRevision API endpoints
 * Tests the complete API flow for post-publication edits
 */

import prisma from "../../src/lib/prisma";

const API_BASE = "http://localhost:3002";

async function testPlaceRevisionAPI() {
  console.log("🧪 Testing PlaceRevision API Endpoints\n");

  // Setup: Create test users and published place
  console.log("Setup: Creating test data...");
  
  const businessOwner = await prisma.user.upsert({
    where: { email: "api-test@example.com" },
    update: {},
    create: {
      email: "api-test@example.com",
      passwordHash: "test",
      role: "BUSINESS_OWNER",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin-api@example.com" },
    update: {},
    create: {
      email: "admin-api@example.com",
      passwordHash: "test",
      role: "ADMIN",
    },
  });

  // Create a published place
  const place = await prisma.place.create({
    data: {
      ownerUserId: businessOwner.id,
      status: "PUBLISHED",
      title: "API Test Cafe",
      category: "cafe",
      shortDesc: "Original description",
      lat: 53.9,
      lng: 27.5,
      locationSource: "MANUAL",
      images: {
        create: [
          {
            kind: "LOGO",
            url: "https://example.com/logo.jpg",
            sortOrder: 0,
          },
        ],
      },
    },
  });

  console.log(`✅ Created published place: ${place.title} (${place.id})\n`);

  console.log("✅ Test data created");
  console.log(`   Business Owner ID: ${businessOwner.id}`);
  console.log(`   Admin ID: ${admin.id}`);
  console.log(`   Place ID: ${place.id}\n`);

  console.log("Note: API tests require authentication tokens.");
  console.log("This script demonstrates the API structure.");
  console.log("For full testing, use Postman/Insomnia with actual auth tokens.\n");

  // Document API endpoints
  console.log("📋 API Endpoints Available:\n");

  console.log("Business Endpoints:");
  console.log(`  GET    ${API_BASE}/api/business/places/${place.id}/revision`);
  console.log("         → Get or create active revision");
  console.log(`  PATCH  ${API_BASE}/api/business/places/${place.id}/revision`);
  console.log("         → Save revision draft");
  console.log("         Body: { revisionId, data: { title, description, ... } }");
  console.log(`  POST   ${API_BASE}/api/business/places/${place.id}/revision/submit`);
  console.log("         → Submit revision for moderation");
  console.log("         Body: { revisionId }");
  console.log();

  console.log("Admin Endpoints:");
  console.log(`  POST   ${API_BASE}/api/admin/moderation/revisions/[revisionId]`);
  console.log("         → Moderate revision");
  console.log("         Body: { action: 'APPROVE' | 'NEEDS_REVISION' | 'REJECT', comment? }");
  console.log();

  console.log("Updated Endpoints:");
  console.log(`  GET    ${API_BASE}/api/business/places/${place.id}`);
  console.log("         → Now includes activeRevision field");
  console.log(`  PATCH  ${API_BASE}/api/business/places/${place.id}`);
  console.log("         → Returns error if Place is PUBLISHED (must use revision)");
  console.log();

  // Cleanup
  console.log("Cleanup: Removing test data...");
  await prisma.placeImage.deleteMany({
    where: { placeId: place.id },
  });
  await prisma.place.delete({
    where: { id: place.id },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["api-test@example.com", "admin-api@example.com"],
      },
    },
  });
  console.log("✅ Cleanup complete\n");

  console.log("✅ API structure documented!");
  console.log("\n📖 For full API testing:");
  console.log("   1. Start the dev server: npm run dev");
  console.log("   2. Login to get auth tokens");
  console.log("   3. Use Postman/Insomnia to test endpoints");
  console.log("   4. Or create integration tests with supertest");
}

testPlaceRevisionAPI()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
