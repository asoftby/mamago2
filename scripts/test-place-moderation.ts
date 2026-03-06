/**
 * Test Place Moderation System
 * 
 * Tests the complete moderation flow:
 * 1. Create a place as PENDING
 * 2. Approve it
 * 3. Create another place
 * 4. Request changes
 * 5. Reject a place
 */

import prisma from "../src/lib/prisma";

async function testPlaceModeration() {
  console.log("=".repeat(80));
  console.log("TEST: Place Moderation System");
  console.log("=".repeat(80));
  console.log();

  try {
    // Get or create test user
    let testUser = await prisma.user.findFirst({
      where: { email: "test-business@example.com" },
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: "test-business@example.com",
          passwordHash: "test",
          role: "BUSINESS_OWNER",
        },
      });
      console.log("✅ Created test user");
    }

    // Get or create admin user
    let adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: "admin@mamago.by",
          passwordHash: "test",
          role: "ADMIN",
        },
      });
      console.log("✅ Created admin user");
    }

    // Get Minsk city
    const minsk = await prisma.city.findFirst({
      where: { slug: "minsk" },
    });

    if (!minsk) {
      throw new Error("Minsk city not found in database");
    }

    console.log("✅ Found Minsk city");
    console.log();

    // Test 1: Create PENDING place
    console.log("Test 1: Create PENDING place");
    console.log("-".repeat(80));

    const place1 = await prisma.place.create({
      data: {
        ownerUserId: testUser.id,
        status: "PENDING",
        title: "Test Place for Moderation",
        category: "cafe",
        shortDesc: "A test place for moderation",
        cityId: minsk.id,
        lat: 53.9,
        lng: 27.56,
      },
    });

    console.log(`✅ Created place: ${place1.title} (${place1.id})`);
    console.log(`   Status: ${place1.status}`);
    console.log();

    // Test 2: Approve place
    console.log("Test 2: Approve place");
    console.log("-".repeat(80));

    await prisma.$transaction([
      prisma.place.update({
        where: { id: place1.id },
        data: { status: "PUBLISHED" },
      }),
      prisma.moderationLog.create({
        data: {
          entityType: "PLACE",
          entityId: place1.id,
          action: "APPROVE",
          message: "Looks good!",
          reviewedByUserId: adminUser.id,
        },
      }),
    ]);

    const approvedPlace = await prisma.place.findUnique({
      where: { id: place1.id },
      select: { status: true },
    });

    console.log(`✅ Approved place: ${place1.title}`);
    console.log(`   New status: ${approvedPlace?.status}`);
    console.log();

    // Test 3: Create place and request changes
    console.log("Test 3: Request changes");
    console.log("-".repeat(80));

    const place2 = await prisma.place.create({
      data: {
        ownerUserId: testUser.id,
        status: "PENDING",
        title: "Test Place Needs Changes",
        category: "museum",
        shortDesc: "This needs some work",
        cityId: minsk.id,
      },
    });

    await prisma.$transaction([
      prisma.place.update({
        where: { id: place2.id },
        data: { status: "NEEDS_CHANGES" },
      }),
      prisma.moderationLog.create({
        data: {
          entityType: "PLACE",
          entityId: place2.id,
          action: "NEEDS_CHANGES",
          message: "Please add location coordinates and contact information",
          reviewedByUserId: adminUser.id,
        },
      }),
    ]);

    const changesPlace = await prisma.place.findUnique({
      where: { id: place2.id },
      select: { status: true },
    });

    console.log(`✅ Requested changes for: ${place2.title}`);
    console.log(`   New status: ${changesPlace?.status}`);
    console.log();

    // Test 4: Reject place
    console.log("Test 4: Reject place");
    console.log("-".repeat(80));

    const place3 = await prisma.place.create({
      data: {
        ownerUserId: testUser.id,
        status: "PENDING",
        title: "Test Place Rejected",
        category: "other",
        shortDesc: "This will be rejected",
        cityId: minsk.id,
      },
    });

    await prisma.$transaction([
      prisma.place.update({
        where: { id: place3.id },
        data: { status: "REJECTED" },
      }),
      prisma.moderationLog.create({
        data: {
          entityType: "PLACE",
          entityId: place3.id,
          action: "REJECT",
          message: "This place does not meet our quality standards",
          reviewedByUserId: adminUser.id,
        },
      }),
    ]);

    const rejectedPlace = await prisma.place.findUnique({
      where: { id: place3.id },
      select: { status: true },
    });

    console.log(`✅ Rejected place: ${place3.title}`);
    console.log(`   New status: ${rejectedPlace?.status}`);
    console.log();

    // Test 5: Get moderation logs
    console.log("Test 5: Get moderation logs");
    console.log("-".repeat(80));

    const logs = await prisma.moderationLog.findMany({
      where: {
        entityType: "PLACE",
        entityId: { in: [place1.id, place2.id, place3.id] },
      },
      include: {
        reviewedBy: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    console.log(`✅ Found ${logs.length} moderation logs:`);
    for (const log of logs) {
      console.log(`   - ${log.action} by ${log.reviewedBy?.email}: "${log.message}"`);
    }
    console.log();

    // Test 6: Get pending queue
    console.log("Test 6: Get pending queue");
    console.log("-".repeat(80));

    const pendingPlaces = await prisma.place.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    console.log(`✅ Found ${pendingPlaces.length} places in queue`);
    console.log();

    console.log("=".repeat(80));
    console.log("✅ ALL TESTS PASSED");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testPlaceModeration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
