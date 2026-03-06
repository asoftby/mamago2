/**
 * Security Test: Place Archive System
 * 
 * Tests that users can ONLY see and archive their own places
 */

import prisma from "../src/lib/prisma";
import { getBusinessPlaces } from "../src/server/services/place.service";
import { archivePlace, unarchivePlace } from "../src/server/services/placeArchive.service";

async function testPlaceSecurity() {
  console.log("🔒 Testing Place Security\n");

  try {
    // Get two different business users
    const users = await prisma.user.findMany({
      where: { role: "BUSINESS_OWNER" },
      take: 2,
    });

    if (users.length < 2) {
      console.log("⚠️  Need at least 2 business users for security test");
      return;
    }

    const [user1, user2] = users;
    console.log(`User 1: ${user1.email} (${user1.id})`);
    console.log(`User 2: ${user2.email} (${user2.id})\n`);

    // Test 1: Each user should only see their own places
    console.log("📋 Test 1: User isolation");
    
    const user1Places = await getBusinessPlaces(user1.id, { archived: false });
    const user2Places = await getBusinessPlaces(user2.id, { archived: false });

    console.log(`  User 1 has ${user1Places.length} active places`);
    console.log(`  User 2 has ${user2Places.length} active places`);

    // Verify no overlap
    const user1PlaceIds = new Set(user1Places.map(p => p.id));
    const user2PlaceIds = new Set(user2Places.map(p => p.id));
    
    const overlap = [...user1PlaceIds].filter(id => user2PlaceIds.has(id));
    
    if (overlap.length > 0) {
      console.log(`  ❌ SECURITY BREACH: ${overlap.length} places visible to both users!`);
      console.log(`  Overlapping IDs: ${overlap.join(", ")}`);
    } else {
      console.log(`  ✅ No overlap - users are properly isolated`);
    }

    // Test 2: User cannot archive another user's place
    if (user2Places.length > 0) {
      console.log(`\n🔐 Test 2: Cross-user archive prevention`);
      const targetPlace = user2Places[0];
      console.log(`  Attempting to archive User 2's place "${targetPlace.title}" as User 1...`);

      try {
        await archivePlace(targetPlace.id, user1.id);
        console.log(`  ❌ SECURITY BREACH: User 1 was able to archive User 2's place!`);
      } catch (error) {
        console.log(`  ✅ Correctly blocked: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Test 3: Archive filtering works correctly
    console.log(`\n📦 Test 3: Archive filtering`);
    
    const user1Active = await getBusinessPlaces(user1.id, { archived: false });
    const user1Archived = await getBusinessPlaces(user1.id, { archived: true });
    const user1All = await getBusinessPlaces(user1.id);

    console.log(`  User 1 active places: ${user1Active.length}`);
    console.log(`  User 1 archived places: ${user1Archived.length}`);
    console.log(`  User 1 total places: ${user1All.length}`);

    if (user1Active.length + user1Archived.length === user1All.length) {
      console.log(`  ✅ Archive filtering is consistent`);
    } else {
      console.log(`  ❌ Archive filtering mismatch!`);
    }

    // Test 4: Verify all archived places belong to correct user
    console.log(`\n🔍 Test 4: Archived places ownership`);
    
    const allArchivedPlaces = await prisma.place.findMany({
      where: { archivedAt: { not: null } },
      select: {
        id: true,
        title: true,
        ownerUserId: true,
        owner: {
          select: {
            email: true,
          },
        },
      },
    });

    console.log(`  Total archived places in DB: ${allArchivedPlaces.length}`);
    
    for (const place of allArchivedPlaces) {
      console.log(`    - "${place.title}" owned by ${place.owner.email}`);
      
      // Verify this place appears in owner's archived list
      const ownerArchived = await getBusinessPlaces(place.ownerUserId, { archived: true });
      const foundInOwnerList = ownerArchived.some(p => p.id === place.id);
      
      if (!foundInOwnerList) {
        console.log(`      ❌ INCONSISTENCY: Place not in owner's archived list!`);
      }
    }

    console.log(`\n✅ Security audit complete!`);

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testPlaceSecurity();
