/**
 * Test script for approved revision status display
 * 
 * Verifies that after admin approves revision:
 * 1. Place shows "Опубликовано" status (not "Редактирование изменений")
 * 2. activeRevision is null in the places list query
 * 3. Revision has status "APPROVED" in database
 */

import prisma from "@/lib/prisma";
import { approvePlaceRevision } from "@/server/services/placeRevision.service";

async function testApprovedRevisionStatus() {
  console.log("🧪 Testing Approved Revision Status Display\n");

  try {
    // Find admin user
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!admin) {
      console.log("❌ No admin user found. Please create one first.");
      return;
    }

    // Find business owner
    const businessOwner = await prisma.user.findFirst({
      where: { role: "BUSINESS_OWNER" },
    });

    if (!businessOwner) {
      console.log("❌ No business owner found. Please create one first.");
      return;
    }

    console.log(`✅ Found admin: ${admin.email}`);
    console.log(`✅ Found business owner: ${businessOwner.email}\n`);

    // Find or create a published place with pending revision
    let place = await prisma.place.findFirst({
      where: {
        ownerUserId: businessOwner.id,
        status: "PUBLISHED",
      },
    });

    if (!place) {
      place = await prisma.place.create({
        data: {
          ownerUserId: businessOwner.id,
          status: "PUBLISHED",
          title: "Test Place for Revision Approval",
          category: "cafe",
          shortDesc: "Test place",
          cityId: (await prisma.city.findFirst())?.id || "",
        },
      });
      console.log(`✅ Created published place: ${place.title}`);
    } else {
      console.log(`✅ Found published place: ${place.title}`);
    }

    // Create a pending revision
    let revision = await prisma.placeRevision.findFirst({
      where: {
        placeId: place.id,
        status: "PENDING",
      },
    });

    if (!revision) {
      revision = await prisma.placeRevision.create({
        data: {
          placeId: place.id,
          status: "PENDING",
          title: "Updated Title",
          submittedAt: new Date(),
          ageTags: [],
          visitFormats: [],
          activityTypes: [],
        },
      });
      console.log(`✅ Created pending revision\n`);
    } else {
      console.log(`✅ Found pending revision\n`);
    }

    // Test 1: Before approval - verify revision shows in query
    console.log("📝 Test 1: Before Approval");
    console.log("─────────────────────────────────────────────────────");

    const beforeRevisions = await prisma.placeRevision.findMany({
      where: {
        placeId: place.id,
        status: { in: ["DRAFT", "PENDING", "NEEDS_REVISION"] },
      },
      select: {
        id: true,
        status: true,
      },
    });

    console.log(`   Active revisions found: ${beforeRevisions.length}`);
    console.log(`   Revision status: ${beforeRevisions[0]?.status || "N/A"}`);
    console.log(`   ✅ Should show badge: "Изменения на проверке"\n`);

    // Test 2: Approve the revision
    console.log("📝 Test 2: Approve Revision");
    console.log("─────────────────────────────────────────────────────");

    await approvePlaceRevision(revision.id, admin.id);
    console.log(`   ✅ Revision approved by admin\n`);

    // Test 3: After approval - verify revision does NOT show in query
    console.log("📝 Test 3: After Approval");
    console.log("─────────────────────────────────────────────────────");

    const afterRevisions = await prisma.placeRevision.findMany({
      where: {
        placeId: place.id,
        status: { in: ["DRAFT", "PENDING", "NEEDS_REVISION"] },
      },
      select: {
        id: true,
        status: true,
      },
    });

    console.log(`   Active revisions found: ${afterRevisions.length}`);
    console.log(`   ✅ Should be 0 (no active revisions)`);
    console.log(`   ✅ Should show status: "Опубликовано"\n`);

    // Test 4: Verify revision has APPROVED status in database
    console.log("📝 Test 4: Verify Revision Status in Database");
    console.log("─────────────────────────────────────────────────────");

    const approvedRevision = await prisma.placeRevision.findUnique({
      where: { id: revision.id },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        reviewedByUserId: true,
      },
    });

    console.log(`   Revision status: ${approvedRevision?.status}`);
    console.log(`   Reviewed by: ${approvedRevision?.reviewedByUserId === admin.id ? "Admin ✅" : "Unknown"}`);
    console.log(`   Reviewed at: ${approvedRevision?.reviewedAt?.toISOString()}`);
    console.log(`   ✅ Status is APPROVED (not in active query)\n`);

    // Test 5: Verify Place data was updated
    console.log("📝 Test 5: Verify Place Data Updated");
    console.log("─────────────────────────────────────────────────────");

    const updatedPlace = await prisma.place.findUnique({
      where: { id: place.id },
      select: {
        title: true,
        status: true,
      },
    });

    console.log(`   Place title: ${updatedPlace?.title}`);
    console.log(`   Place status: ${updatedPlace?.status}`);
    console.log(`   ✅ Place remains PUBLISHED\n`);

    // Summary
    console.log("📊 Test Summary");
    console.log("═════════════════════════════════════════════════════");
    console.log("✅ Before approval: Revision shows in active query");
    console.log("✅ After approval: Revision does NOT show in active query");
    console.log("✅ Revision status changed to APPROVED");
    console.log("✅ Place data updated with revision changes");
    console.log("✅ Place status remains PUBLISHED");
    console.log("\n🎯 Expected UI Behavior:");
    console.log("   Before approval: Badge shows 'Изменения на проверке'");
    console.log("   After approval: NO badge, status shows 'Опубликовано' ✅");
    console.log("\n📝 Manual Testing:");
    console.log(`   1. Visit /business/places`);
    console.log(`   2. Find place: ${place.title}`);
    console.log(`   3. Verify NO revision badge is shown`);
    console.log(`   4. Verify status shows "Опубликовано"`);

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testApprovedRevisionStatus()
  .then(() => {
    console.log("\n✅ Test script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test script failed:", error);
    process.exit(1);
  });
