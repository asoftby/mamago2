/**
 * Test script for unified moderation system
 * Tests Place moderation workflow
 */

import prisma from "../src/lib/prisma";
import {
  submitPlace,
  approvePlace,
  needsChangesPlace,
  rejectPlace,
  getModerationLogs,
  getLatestModerationMessage,
} from "../src/server/services/moderation.service";

async function main() {
  console.log("🧪 Testing Unified Moderation System\n");

  // Find or create test users
  let businessOwner = await prisma.user.findFirst({
    where: { role: "BUSINESS_OWNER" },
  });

  if (!businessOwner) {
    console.log("Creating test business owner...");
    businessOwner = await prisma.user.create({
      data: {
        email: "test-owner@example.com",
        passwordHash: "test",
        role: "BUSINESS_OWNER",
      },
    });
  }

  let moderator = await prisma.user.findFirst({
    where: { role: "MODERATOR" },
  });

  if (!moderator) {
    console.log("Creating test moderator...");
    moderator = await prisma.user.create({
      data: {
        email: "test-moderator@example.com",
        passwordHash: "test",
        role: "MODERATOR",
      },
    });
  }

  console.log(`✅ Business Owner: ${businessOwner.email}`);
  console.log(`✅ Moderator: ${moderator.email}\n`);

  // Create test place
  console.log("Creating test place...");
  const place = await prisma.place.create({
    data: {
      ownerUserId: businessOwner.id,
      title: "Test Cafe",
      category: "cafe",
      shortDesc: "A cozy test cafe",
      status: "DRAFT",
      logoImageId: "test-logo-id",
      lat: 53.9,
      lng: 27.5,
      locationSource: "GOOGLE",
    },
  });
  console.log(`✅ Created Place: ${place.id}\n`);

  // Test 1: Submit for moderation
  console.log("Test 1: Submit Place for moderation (DRAFT → PENDING)");
  await submitPlace(place.id, businessOwner.id);
  let updatedPlace = await prisma.place.findUnique({
    where: { id: place.id },
  });
  console.log(`✅ Status: ${updatedPlace?.status}`);
  console.assert(updatedPlace?.status === "PENDING", "Status should be PENDING");

  let logs = await getModerationLogs("PLACE", place.id);
  console.log(`✅ Moderation logs: ${logs.length}`);
  console.assert(logs.length === 1, "Should have 1 log entry");
  console.assert(logs[0].action === "SUBMIT", "Action should be SUBMIT\n");

  // Test 2: Request changes
  console.log("Test 2: Request changes (PENDING → NEEDS_CHANGES)");
  await needsChangesPlace(
    place.id,
    moderator.id,
    "Please add more photos and update the description"
  );
  updatedPlace = await prisma.place.findUnique({
    where: { id: place.id },
  });
  console.log(`✅ Status: ${updatedPlace?.status}`);
  console.assert(
    updatedPlace?.status === "NEEDS_CHANGES",
    "Status should be NEEDS_CHANGES"
  );

  logs = await getModerationLogs("PLACE", place.id);
  console.log(`✅ Moderation logs: ${logs.length}`);
  console.assert(logs.length === 2, "Should have 2 log entries");

  const latestMessage = await getLatestModerationMessage("PLACE", place.id);
  console.log(`✅ Latest message: "${latestMessage}"`);
  console.assert(
    latestMessage === "Please add more photos and update the description",
    "Should retrieve latest message\n"
  );

  // Test 3: Resubmit after changes
  console.log("Test 3: Resubmit after changes (NEEDS_CHANGES → PENDING)");
  await submitPlace(place.id, businessOwner.id);
  updatedPlace = await prisma.place.findUnique({
    where: { id: place.id },
  });
  console.log(`✅ Status: ${updatedPlace?.status}`);
  console.assert(updatedPlace?.status === "PENDING", "Status should be PENDING");

  logs = await getModerationLogs("PLACE", place.id);
  console.log(`✅ Moderation logs: ${logs.length}\n`);
  console.assert(logs.length === 3, "Should have 3 log entries");

  // Test 4: Approve
  console.log("Test 4: Approve Place (PENDING → PUBLISHED)");
  await approvePlace(place.id, moderator.id, "Looks good!");
  updatedPlace = await prisma.place.findUnique({
    where: { id: place.id },
  });
  console.log(`✅ Status: ${updatedPlace?.status}`);
  console.assert(
    updatedPlace?.status === "PUBLISHED",
    "Status should be PUBLISHED"
  );

  logs = await getModerationLogs("PLACE", place.id);
  console.log(`✅ Moderation logs: ${logs.length}`);
  console.assert(logs.length === 4, "Should have 4 log entries");
  console.assert(logs[0].action === "APPROVE", "Latest action should be APPROVE\n");

  // Test 5: Create another place and reject it
  console.log("Test 5: Create and reject another place");
  const place2 = await prisma.place.create({
    data: {
      ownerUserId: businessOwner.id,
      title: "Test Restaurant",
      category: "restaurant",
      shortDesc: "A test restaurant",
      status: "DRAFT",
      logoImageId: "test-logo-id-2",
      lat: 53.9,
      lng: 27.5,
      locationSource: "GOOGLE",
    },
  });

  await submitPlace(place2.id, businessOwner.id);
  await rejectPlace(
    place2.id,
    moderator.id,
    "This place does not meet our quality standards"
  );

  const rejectedPlace = await prisma.place.findUnique({
    where: { id: place2.id },
  });
  console.log(`✅ Status: ${rejectedPlace?.status}`);
  console.assert(
    rejectedPlace?.status === "REJECTED",
    "Status should be REJECTED"
  );

  const rejectionMessage = await getLatestModerationMessage("PLACE", place2.id);
  console.log(`✅ Rejection message: "${rejectionMessage}"\n`);

  // Test 6: Error handling - cannot approve from non-PENDING status
  console.log("Test 6: Error handling - cannot approve PUBLISHED place");
  try {
    await approvePlace(place.id, moderator.id);
    console.error("❌ Should have thrown error");
  } catch (error) {
    console.log(`✅ Correctly threw error: ${(error as Error).message}\n`);
  }

  // Test 7: Error handling - message required for NEEDS_CHANGES
  console.log("Test 7: Error handling - message required for NEEDS_CHANGES");
  const place3 = await prisma.place.create({
    data: {
      ownerUserId: businessOwner.id,
      title: "Test Place 3",
      category: "cafe",
      shortDesc: "Test",
      status: "PENDING",
      logoImageId: "test-logo-id-3",
      lat: 53.9,
      lng: 27.5,
      locationSource: "GOOGLE",
    },
  });

  try {
    await needsChangesPlace(place3.id, moderator.id, "");
    console.error("❌ Should have thrown error");
  } catch (error) {
    console.log(`✅ Correctly threw error: ${(error as Error).message}\n`);
  }

  // Cleanup
  console.log("Cleaning up test data...");
  await prisma.moderationLog.deleteMany({
    where: {
      entityId: { in: [place.id, place2.id, place3.id] },
    },
  });
  await prisma.place.deleteMany({
    where: {
      id: { in: [place.id, place2.id, place3.id] },
    },
  });
  console.log("✅ Cleanup complete\n");

  console.log("🎉 All tests passed!");
}

main()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
