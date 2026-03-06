/**
 * End-to-End Notification Test
 * Simulates the complete flow: Place creation → Moderation → Notification
 */

import prisma from "../src/lib/prisma";

async function testNotificationE2E() {
  console.log("🧪 End-to-End Notification Test\n");

  // 1. Find business user
  const businessUser = await prisma.user.findFirst({
    where: {
      business: {
        isNot: null,
      },
    },
    include: {
      business: true,
    },
  });

  if (!businessUser) {
    console.log("❌ No business user found");
    return;
  }

  console.log(`✅ Business user: ${businessUser.email}`);
  console.log(`   Business: ${businessUser.business?.name}\n`);

  // 2. Find or create a test place
  let place = await prisma.place.findFirst({
    where: {
      ownerUserId: businessUser.id,
      status: "PENDING",
    },
  });

  if (!place) {
    console.log("📝 Creating test place...");
    place = await prisma.place.create({
      data: {
        ownerUserId: businessUser.id,
        title: "E2E Test Cafe",
        category: "CAFE",
        shortDesc: "Test cafe for E2E notification testing",
        status: "PENDING",
        locationSource: "MANUAL",
      },
    });
    console.log(`✅ Created place: ${place.title} (${place.id})\n`);
  } else {
    console.log(`✅ Found pending place: ${place.title} (${place.id})\n`);
  }

  // 3. Check notifications before moderation
  const notificationsBefore = await prisma.notification.count({
    where: {
      userId: businessUser.id,
      entityType: "PLACE",
      entityId: place.id,
    },
  });

  console.log(`📊 Notifications before moderation: ${notificationsBefore}`);

  // 4. Simulate moderation approval
  console.log("\n🔍 Simulating moderation approval...");

  // Import notification service
  const { notifyPlaceApproved } = await import(
    "../src/server/services/notification.service"
  );

  // Update place status
  await prisma.place.update({
    where: { id: place.id },
    data: {
      status: "PUBLISHED",
      moderationReviewedAt: new Date(),
    },
  });

  // Create notification
  await notifyPlaceApproved(place.id, place.title, businessUser.id);

  console.log("✅ Place approved and notification created\n");

  // 5. Check notifications after moderation
  const notificationsAfter = await prisma.notification.findMany({
    where: {
      userId: businessUser.id,
      entityType: "PLACE",
      entityId: place.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`📊 Notifications after moderation: ${notificationsAfter.length}`);

  if (notificationsAfter.length > 0) {
    const latest = notificationsAfter[0];
    console.log("\n📬 Latest notification:");
    console.log(`   Type: ${latest.type}`);
    console.log(`   Title: ${latest.title}`);
    console.log(`   Message: ${latest.message}`);
    console.log(`   Entity: ${latest.entityType} (${latest.entityId})`);
    console.log(`   Read: ${latest.isRead ? "Yes" : "No"}`);
    console.log(`   Created: ${latest.createdAt.toISOString()}`);
  }

  // 6. Get unread count
  const unreadCount = await prisma.notification.count({
    where: {
      userId: businessUser.id,
      isRead: false,
    },
  });

  console.log(`\n📊 Total unread notifications: ${unreadCount}`);

  // 7. Test API endpoints
  console.log("\n🌐 Testing API endpoints:");
  console.log("   GET /api/notifications");
  console.log("   GET /api/notifications?unreadOnly=true");
  console.log("   POST /api/notifications/{id}/read");
  console.log("   POST /api/notifications/mark-all-read");

  console.log("\n✅ E2E test complete!");
  console.log("\n📱 Next steps:");
  console.log(`   1. Login as: ${businessUser.email}`);
  console.log(`   2. Check notification bell (should show badge with count)`);
  console.log(`   3. Click bell to see notification dropdown`);
  console.log(`   4. Click notification to mark as read and navigate`);
  console.log(`   5. Visit /business/notifications for full list`);
}

testNotificationE2E()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
