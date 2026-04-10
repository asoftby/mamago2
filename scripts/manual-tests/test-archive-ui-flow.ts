/**
 * Test Archive UI Flow
 * 
 * Simulates the user flow:
 * 1. View active places
 * 2. Archive a place
 * 3. Check it's removed from active
 * 4. Switch to archived tab
 * 5. Check it appears in archived
 * 6. Unarchive it
 * 7. Check it's removed from archived
 * 8. Switch to active tab
 * 9. Check it appears in active
 */

import prisma from "../../src/lib/prisma";
import { getBusinessPlaces } from "../../src/server/services/place.service";
import { archivePlace, unarchivePlace } from "../../src/server/services/placeArchive.service";

async function testArchiveUIFlow() {
  console.log("🎭 Testing Archive UI Flow\n");

  try {
    // Get a business user with places
    const user = await prisma.user.findFirst({
      where: {
        role: "BUSINESS_OWNER",
        places: {
          some: {
            archivedAt: null, // Has at least one active place
          },
        },
      },
    });

    if (!user) {
      console.log("⚠️  No business user with active places found");
      return;
    }

    console.log(`Testing with user: ${user.email}\n`);

    // Step 1: View active places
    console.log("📋 Step 1: View active places");
    const activeBefore = await getBusinessPlaces(user.id, { archived: false });
    console.log(`  Active places: ${activeBefore.length}`);
    activeBefore.forEach(p => console.log(`    - ${p.title}`));

    if (activeBefore.length === 0) {
      console.log("  ⚠️  No active places to test with");
      return;
    }

    const testPlace = activeBefore[0];
    console.log(`\n  Will test with: "${testPlace.title}" (${testPlace.id})\n`);

    // Step 2: Archive the place
    console.log("📦 Step 2: Archive the place");
    await archivePlace(testPlace.id, user.id);
    console.log(`  ✅ Archived "${testPlace.title}"`);

    // Step 3: Check it's removed from active
    console.log("\n🔍 Step 3: Check active list");
    const activeAfterArchive = await getBusinessPlaces(user.id, { archived: false });
    console.log(`  Active places: ${activeAfterArchive.length}`);
    
    const stillInActive = activeAfterArchive.some(p => p.id === testPlace.id);
    if (stillInActive) {
      console.log(`  ❌ BUG: Place still in active list!`);
    } else {
      console.log(`  ✅ Place removed from active list`);
    }

    // Step 4: Switch to archived tab
    console.log("\n📂 Step 4: View archived places");
    const archivedAfterArchive = await getBusinessPlaces(user.id, { archived: true });
    console.log(`  Archived places: ${archivedAfterArchive.length}`);
    archivedAfterArchive.forEach(p => console.log(`    - ${p.title}`));

    // Step 5: Check it appears in archived
    console.log("\n🔍 Step 5: Check archived list");
    const inArchived = archivedAfterArchive.some(p => p.id === testPlace.id);
    if (inArchived) {
      console.log(`  ✅ Place appears in archived list`);
    } else {
      console.log(`  ❌ BUG: Place NOT in archived list!`);
    }

    // Step 6: Unarchive it
    console.log("\n📤 Step 6: Unarchive the place");
    await unarchivePlace(testPlace.id, user.id);
    console.log(`  ✅ Unarchived "${testPlace.title}"`);

    // Step 7: Check it's removed from archived
    console.log("\n🔍 Step 7: Check archived list");
    const archivedAfterUnarchive = await getBusinessPlaces(user.id, { archived: true });
    console.log(`  Archived places: ${archivedAfterUnarchive.length}`);
    
    const stillInArchived = archivedAfterUnarchive.some(p => p.id === testPlace.id);
    if (stillInArchived) {
      console.log(`  ❌ BUG: Place still in archived list!`);
    } else {
      console.log(`  ✅ Place removed from archived list`);
    }

    // Step 8: Switch to active tab
    console.log("\n📋 Step 8: View active places");
    const activeAfterUnarchive = await getBusinessPlaces(user.id, { archived: false });
    console.log(`  Active places: ${activeAfterUnarchive.length}`);
    activeAfterUnarchive.forEach(p => console.log(`    - ${p.title}`));

    // Step 9: Check it appears in active
    console.log("\n🔍 Step 9: Check active list");
    const backInActive = activeAfterUnarchive.some(p => p.id === testPlace.id);
    if (backInActive) {
      console.log(`  ✅ Place back in active list`);
    } else {
      console.log(`  ❌ BUG: Place NOT in active list!`);
    }

    console.log("\n✅ UI Flow test complete!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testArchiveUIFlow();
