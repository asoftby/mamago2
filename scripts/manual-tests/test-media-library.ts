/**
 * Test Media Library
 * 
 * Tests media library functionality
 */

import { prisma } from "../../src/lib/prisma";
import { getMediaStats } from "../../src/server/services/media/media.service";
import { getAdminMediaList } from "../../src/server/services/media/media-query.service";
import { getMediaUsagesWithDetails } from "../../src/server/services/media/media-usage.service";

async function testMediaLibrary() {
  console.log("🧪 Testing Media Library...\n");

  // Test 1: Get stats
  console.log("1️⃣ Testing getMediaStats()...");
  const stats = await getMediaStats();
  console.log("Stats:", JSON.stringify(stats, null, 2));

  // Test 2: Get media list
  console.log("\n2️⃣ Testing getAdminMediaList()...");
  const list = await getAdminMediaList({}, { page: 1, limit: 10 });
  console.log(`Found ${list.items.length} media assets (total: ${list.pagination.total})`);
  
  if (list.items.length > 0) {
    const first = list.items[0];
    console.log("\nFirst media:");
    console.log(`- ID: ${first.id}`);
    console.log(`- Filename: ${first.filename}`);
    console.log(`- Kind: ${first.kind}`);
    console.log(`- Status: ${first.status}`);
    console.log(`- Usages: ${first.usages.length}`);

    // Test 3: Get usages with details
    console.log("\n3️⃣ Testing getMediaUsagesWithDetails()...");
    const usages = await getMediaUsagesWithDetails(first.id);
    console.log(`Found ${usages.length} usages:`);
    usages.forEach((usage) => {
      console.log(`- ${usage.entityType}:${usage.entityId} (${usage.field})`);
      if (usage.entityName) {
        console.log(`  Name: ${usage.entityName}`);
      }
      if (usage.entityUrl) {
        console.log(`  URL: ${usage.entityUrl}`);
      }
    });
  }

  // Test 4: Search
  console.log("\n4️⃣ Testing search...");
  const searchResults = await getAdminMediaList(
    { search: "place" },
    { page: 1, limit: 5 }
  );
  console.log(`Search results: ${searchResults.items.length}`);

  // Test 5: Filter by kind
  console.log("\n5️⃣ Testing filter by kind...");
  const imageResults = await getAdminMediaList(
    { kind: "IMAGE" },
    { page: 1, limit: 5 }
  );
  console.log(`Images: ${imageResults.pagination.total}`);

  // Test 6: Filter orphaned
  console.log("\n6️⃣ Testing orphaned filter...");
  const orphanedResults = await getAdminMediaList(
    { isOrphaned: true },
    { page: 1, limit: 5 }
  );
  console.log(`Orphaned: ${orphanedResults.pagination.total}`);

  console.log("\n✅ All tests passed!");
}

testMediaLibrary()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
