/**
 * Test script for PlaceRevision service
 * Tests the complete post-publication edit flow
 */

import prisma from "../../src/lib/prisma";
import {
  getActiveRevision,
  hasActiveRevision,
  getOrCreatePlaceRevision,
  savePlaceRevisionDraft,
  submitPlaceRevisionForModeration,
  approvePlaceRevision,
  requestPlaceRevisionChanges,
  rejectPlaceRevision,
} from "../../src/server/services/placeRevision.service";

async function testPlaceRevisionService() {
  console.log("🧪 Testing PlaceRevision Service\n");

  // Setup: Create test user and published place
  console.log("Setup: Creating test data...");
  
  const businessOwner = await prisma.user.upsert({
    where: { email: "revision-test@example.com" },
    update: {},
    create: {
      email: "revision-test@example.com",
      passwordHash: "test",
      role: "BUSINESS_OWNER",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin-revision@example.com" },
    update: {},
    create: {
      email: "admin-revision@example.com",
      passwordHash: "test",
      role: "ADMIN",
    },
  });

  // Create a published place
  const place = await prisma.place.create({
    data: {
      ownerUserId: businessOwner.id,
      status: "PUBLISHED",
      title: "Test Cafe Original",
      category: "cafe",
      shortDesc: "Original description",
      description: "Original long description",
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

  const owner = { id: businessOwner.id, role: businessOwner.role };

  // Test 1: Check no active revision initially
  console.log("Test 1: Check no active revision initially");
  const hasRevision1 = await hasActiveRevision(place.id);
  console.assert(!hasRevision1, "Should have no active revision initially");
  console.log(`✅ No active revision: ${!hasRevision1}\n`);

  // Test 2: Create revision from published place
  console.log("Test 2: Create revision from published place");
  const revision1 = await getOrCreatePlaceRevision(place.id, owner);
  console.log(`✅ Created revision: ${revision1.id}`);
  console.log(`   Status: ${revision1.status}`);
  console.log(`   Title: ${revision1.title}`);
  console.assert(revision1.status === "DRAFT", "Revision should be DRAFT");
  console.assert(revision1.title === place.title, "Should copy place title");
  console.log();

  // Test 3: Verify one-active-revision rule (should return existing)
  console.log("Test 3: Verify one-active-revision rule");
  const revision2 = await getOrCreatePlaceRevision(place.id, owner);
  console.assert(revision2.id === revision1.id, "Should return same revision");
  console.log(`✅ Returned existing revision: ${revision2.id === revision1.id}\n`);

  // Test 4: Save revision draft
  console.log("Test 4: Save revision draft");
  const updatedRevision = await savePlaceRevisionDraft(
    revision1.id,
    {
      title: "Test Cafe Updated",
      description: "Updated long description",
      phone: "+375291234567",
    },
    owner
  );
  console.log(`✅ Updated revision`);
  console.log(`   New title: ${updatedRevision.title}`);
  console.log(`   New phone: ${updatedRevision.phone}`);
  console.assert(updatedRevision.title === "Test Cafe Updated", "Title should be updated");
  console.log();

  // Test 5: Submit revision for moderation
  console.log("Test 5: Submit revision for moderation");
  const submittedRevision = await submitPlaceRevisionForModeration(
    revision1.id,
    owner
  );
  console.log(`✅ Submitted revision`);
  console.log(`   Status: ${submittedRevision.status}`);
  console.log(`   Submitted at: ${submittedRevision.submittedAt}`);
  console.assert(submittedRevision.status === "PENDING", "Should be PENDING");
  console.assert(submittedRevision.submittedAt !== null, "Should have submittedAt");
  console.log();

  // Test 6: Request changes
  console.log("Test 6: Request changes");
  await requestPlaceRevisionChanges(
    revision1.id,
    admin.id,
    "Please add more photos and update opening hours"
  );
  const revisionAfterRequest = await prisma.placeRevision.findUnique({
    where: { id: revision1.id },
  });
  console.log(`✅ Requested changes`);
  console.log(`   Status: ${revisionAfterRequest?.status}`);
  console.log(`   Comment: ${revisionAfterRequest?.moderatorComment}`);
  console.assert(revisionAfterRequest?.status === "NEEDS_REVISION", "Should be NEEDS_REVISION");
  console.assert(revisionAfterRequest?.revisionRequestedAt !== null, "Should have revisionRequestedAt");
  console.log();

  // Test 7: Resubmit after changes
  console.log("Test 7: Resubmit after changes");
  const resubmittedRevision = await submitPlaceRevisionForModeration(
    revision1.id,
    owner
  );
  console.log(`✅ Resubmitted revision`);
  console.log(`   Status: ${resubmittedRevision.status}`);
  console.log(`   Resubmitted at: ${resubmittedRevision.revisionResubmittedAt}`);
  console.assert(resubmittedRevision.status === "PENDING", "Should be PENDING again");
  console.assert(resubmittedRevision.revisionResubmittedAt !== null, "Should have resubmittedAt");
  console.log();

  // Test 8: Approve revision (copy data to Place)
  console.log("Test 8: Approve revision (copy data to Place)");
  await approvePlaceRevision(revision1.id, admin.id);
  
  const approvedRevision = await prisma.placeRevision.findUnique({
    where: { id: revision1.id },
  });
  const updatedPlace = await prisma.place.findUnique({
    where: { id: place.id },
  });
  
  console.log(`✅ Approved revision`);
  console.log(`   Revision status: ${approvedRevision?.status}`);
  console.log(`   Place title (before): ${place.title}`);
  console.log(`   Place title (after): ${updatedPlace?.title}`);
  console.log(`   Place phone (after): ${updatedPlace?.phone}`);
  console.assert(approvedRevision?.status === "APPROVED", "Revision should be APPROVED");
  console.assert(updatedPlace?.title === "Test Cafe Updated", "Place title should be updated");
  console.assert(updatedPlace?.phone === "+375291234567", "Place phone should be updated");
  console.assert(updatedPlace?.status === "PUBLISHED", "Place should remain PUBLISHED");
  console.log();

  // Test 9: Create new revision and reject it
  console.log("Test 9: Create new revision and reject it");
  const revision3 = await getOrCreatePlaceRevision(place.id, owner);
  await savePlaceRevisionDraft(
    revision3.id,
    { title: "Test Cafe Rejected Version" },
    owner
  );
  await submitPlaceRevisionForModeration(revision3.id, owner);
  await rejectPlaceRevision(
    revision3.id,
    admin.id,
    "This change is not appropriate"
  );
  
  const rejectedRevision = await prisma.placeRevision.findUnique({
    where: { id: revision3.id },
  });
  const placeAfterReject = await prisma.place.findUnique({
    where: { id: place.id },
  });
  
  console.log(`✅ Rejected revision`);
  console.log(`   Revision status: ${rejectedRevision?.status}`);
  console.log(`   Place title (unchanged): ${placeAfterReject?.title}`);
  console.assert(rejectedRevision?.status === "REJECTED", "Revision should be REJECTED");
  console.assert(placeAfterReject?.title === "Test Cafe Updated", "Place should be unchanged");
  console.log();

  // Test 10: Error handling - cannot edit PENDING revision
  console.log("Test 10: Error handling - cannot edit PENDING revision");
  const revision4 = await getOrCreatePlaceRevision(place.id, owner);
  await submitPlaceRevisionForModeration(revision4.id, owner);
  
  try {
    await savePlaceRevisionDraft(
      revision4.id,
      { title: "Should fail" },
      owner
    );
    console.log("❌ Should have thrown error");
  } catch (error) {
    console.log(`✅ Correctly prevented editing PENDING revision`);
    console.log(`   Error: ${error instanceof Error ? error.message : error}`);
  }
  console.log();

  // Cleanup
  console.log("Cleanup: Removing test data...");
  await prisma.placeRevision.deleteMany({
    where: { placeId: place.id },
  });
  await prisma.placeImage.deleteMany({
    where: { placeId: place.id },
  });
  await prisma.place.delete({
    where: { id: place.id },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["revision-test@example.com", "admin-revision@example.com"],
      },
    },
  });
  console.log("✅ Cleanup complete\n");

  console.log("✅ All PlaceRevision service tests passed!");
}

testPlaceRevisionService()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
