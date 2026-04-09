/**
 * Test Notification System
 * 
 * Tests the notification creation when Place is approved
 */

import prisma from "../src/lib/prisma";
import {
  notifyPlaceApproved,
  notifyPlaceNeedsChanges,
  notifyPlaceRejected,
  getUnreadNotifications,
  getUnreadCount,
  markNotificationAsRead,
} from "../src/server/services/notification.service";

async function testNotificationSystem() {
  console.log("=".repeat(80));
  console.log("TEST: Notification System");
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

    // Get Minsk city
    const minsk = await prisma.city.findFirst({
      where: { slug: "minsk" },
    });

    if (!minsk) {
      throw new Error("Minsk city not found in database");
    }

    // Test 1: Create place and approve it
    console.log("Test 1: Place Approved Notification");
    console.log("-".repeat(80));

    const place1 = await prisma.place.create({
      data: {
        ownerUserId: testUser.id,
        status: "PENDING",
        title: "Test Cafe for Notifications",
        category: "cafe",
        shortDesc: "A test cafe",
        cityId: minsk.id,
      },
    });

    console.log(`✅ Created place: ${place1.title}`);

    // Create approval notification
    await notifyPlaceApproved(place1.id, place1.title, testUser.id);
    console.log("✅ Created PLACE_APPROVED notification");
    console.log();

    // Test 2: Check unread notifications
    console.log("Test 2: Get Unread Notifications");
    console.log("-".repeat(80));

    const unreadNotifications = await getUnreadNotifications(testUser.id);
    console.log(`✅ Found ${unreadNotifications.length} unread notifications`);

    if (unreadNotifications.length > 0) {
      const notification = unreadNotifications[0];
      console.log(`   Type: ${notification.type}`);
      console.log(`   Title: ${notification.title}`);
      console.log(`   Body: ${notification.body}`);
      console.log(`   Entity: ${notification.entityType}/${notification.entityId}`);
    }
    console.log();

    // Test 3: Get unread count
    console.log("Test 3: Get Unread Count");
    console.log("-".repeat(80));

    const unreadCount = await getUnreadCount(testUser.id);
    console.log(`✅ Unread count: ${unreadCount}`);
    console.log();

    // Test 4: Mark as read
    console.log("Test 4: Mark Notification as Read");
    console.log("-".repeat(80));

    if (unreadNotifications.length > 0) {
      await markNotificationAsRead(unreadNotifications[0].id, testUser.id);
      console.log("✅ Marked notification as read");

      const newUnreadCount = await getUnreadCount(testUser.id);
      console.log(`✅ New unread count: ${newUnreadCount}`);
    }
    console.log();

    // Test 5: NEEDS_CHANGES notification
    console.log("Test 5: Place Needs Changes Notification");
    console.log("-".repeat(80));

    const place2 = await prisma.place.create({
      data: {
        ownerUserId: testUser.id,
        status: "PENDING",
        title: "Test Museum",
        category: "museum",
        shortDesc: "A test museum",
        cityId: minsk.id,
      },
    });

    await notifyPlaceNeedsChanges(
      place2.id,
      place2.title,
      testUser.id,
      "Пожалуйста, добавьте фотографии и укажите точный адрес."
    );
    console.log("✅ Created PLACE_NEEDS_CHANGES notification");
    console.log();

    // Test 6: REJECTED notification
    console.log("Test 6: Place Rejected Notification");
    console.log("-".repeat(80));

    const place3 = await prisma.place.create({
      data: {
        ownerUserId: testUser.id,
        status: "PENDING",
        title: "Test Park",
        category: "park",
        shortDesc: "A test park",
        cityId: minsk.id,
      },
    });

    await notifyPlaceRejected(
      place3.id,
      place3.title,
      testUser.id,
      "Место не соответствует требованиям платформы."
    );
    console.log("✅ Created PLACE_REJECTED notification");
    console.log();

    // Test 7: Get all notifications
    console.log("Test 7: Get All Notifications");
    console.log("-".repeat(80));

    const allNotifications = await getUnreadNotifications(testUser.id);
    console.log(`✅ Total unread notifications: ${allNotifications.length}`);

    for (const notif of allNotifications) {
      console.log(`   - ${notif.type}: ${notif.title}`);
    }
    console.log();

    console.log("=".repeat(80));
    console.log("✅ ALL TESTS PASSED");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testNotificationSystem()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
