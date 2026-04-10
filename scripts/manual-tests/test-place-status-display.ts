/**
 * Test script for Place status display in business cabinet
 * 
 * Verifies that status badges are shown correctly for all place statuses
 */

import prisma from "@/lib/prisma";

async function testPlaceStatusDisplay() {
  console.log("🧪 Testing Place Status Display in Business Cabinet\n");

  try {
    // Find business owner
    const businessOwner = await prisma.user.findFirst({
      where: { role: "BUSINESS_OWNER" },
    });

    if (!businessOwner) {
      console.log("❌ No business owner found. Please create one first.");
      return;
    }

    console.log(`✅ Found business owner: ${businessOwner.email}\n`);

    // Get all places for this user
    const places = await prisma.place.findMany({
      where: {
        ownerUserId: businessOwner.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        archivedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`📊 Found ${places.length} places\n`);

    // Group by status
    const byStatus = places.reduce((acc, place) => {
      const status = place.archivedAt ? "ARCHIVED" : place.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(place);
      return acc;
    }, {} as Record<string, typeof places>);

    // Display status badges
    console.log("📝 Status Badge Display:");
    console.log("═════════════════════════════════════════════════════");

    const statusLabels = {
      DRAFT: "Черновик (серый)",
      PENDING: "На модерации (серый с рамкой)",
      PUBLISHED: "Опубликовано (зеленый) ✅",
      NEEDS_REVISION: "Требует правок (оранжевый)",
      REJECTED: "Отклонено (красный)",
      ARCHIVED: "Архив (серый, без статуса)",
    };

    for (const [status, statusPlaces] of Object.entries(byStatus)) {
      console.log(`\n${statusLabels[status as keyof typeof statusLabels] || status}:`);
      console.log(`   Count: ${statusPlaces.length}`);
      statusPlaces.slice(0, 3).forEach(p => {
        console.log(`   - ${p.title}`);
      });
    }

    // Check for published places with revisions
    console.log("\n\n📝 Published Places with Active Revisions:");
    console.log("═════════════════════════════════════════════════════");

    const publishedPlaces = places.filter(p => p.status === "PUBLISHED" && !p.archivedAt);
    
    if (publishedPlaces.length > 0) {
      const revisions = await prisma.placeRevision.findMany({
        where: {
          placeId: { in: publishedPlaces.map(p => p.id) },
          status: { in: ["DRAFT", "PENDING", "NEEDS_REVISION"] },
        },
        select: {
          placeId: true,
          status: true,
        },
      });

      const revisionMap = new Map(revisions.map(r => [r.placeId, r.status]));

      publishedPlaces.forEach(place => {
        const revisionStatus = revisionMap.get(place.id);
        if (revisionStatus) {
          const revisionLabel = 
            revisionStatus === "DRAFT" ? "Редактирование изменений (синий)" :
            revisionStatus === "PENDING" ? "Изменения на проверке (желтый)" :
            "Требуются правки (оранжевый)";
          console.log(`   ${place.title}: ${revisionLabel}`);
        } else {
          console.log(`   ${place.title}: Нет активной ревизии (только "Опубликовано") ✅`);
        }
      });
    } else {
      console.log("   Нет опубликованных мест");
    }

    // Summary
    console.log("\n\n📊 Expected UI Display:");
    console.log("═════════════════════════════════════════════════════");
    console.log("✅ DRAFT: Badge 'Черновик' (серый)");
    console.log("✅ PENDING: Badge 'На модерации' (серый с рамкой)");
    console.log("✅ PUBLISHED: Badge 'Опубликовано' (зеленый) ✅");
    console.log("✅ NEEDS_REVISION: Badge 'Требует правок' (оранжевый)");
    console.log("✅ REJECTED: Badge 'Отклонено' (красный)");
    console.log("✅ ARCHIVED: No status badge shown");
    console.log("\n✅ PUBLISHED + active revision: Two badges:");
    console.log("   1. 'Опубликовано' (зеленый)");
    console.log("   2. Revision badge (синий/желтый/оранжевый)");
    console.log("\n📝 Manual Testing:");
    console.log("   1. Visit /business/places");
    console.log("   2. Verify each place shows correct status badge");
    console.log("   3. Check colors match the design");

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testPlaceStatusDisplay()
  .then(() => {
    console.log("\n✅ Test script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test script failed:", error);
    process.exit(1);
  });
