/**
 * Test script for notification UI
 * Tests the notification API endpoints that the UI will use
 */

import prisma from "../src/lib/prisma";
import {
  WELCOME_NOTIFICATION_BODY,
  WELCOME_NOTIFICATION_TITLE,
} from "../src/lib/notifications/welcomeNotification";
import { createNotification } from "../src/server/services/notification.service";

async function testNotificationUI() {
  console.log("🧪 Testing Notification UI APIs\n");

  // Find a business user
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
    console.log("❌ No business user found. Create a business first.");
    return;
  }

  console.log(`✅ Found business user: ${businessUser.email}`);
  console.log(`   Business: ${businessUser.business?.name}\n`);

  // Create test notifications
  console.log("📝 Creating test notifications...");

  const notification1 = await createNotification({
    userId: businessUser.id,
    type: "PLACE_APPROVED",
    title: "Место опубликовано",
    body: "Ваше место «Test Cafe» успешно прошло модерацию и теперь доступно пользователям mamaGo.",
    entityType: "PLACE",
    entityId: "test-place-1",
  });

  const notification2 = await createNotification({
    userId: businessUser.id,
    type: "PLACE_NEEDS_CHANGES",
    title: "Требуются правки",
    body: "Ваше место «Test Restaurant» требует доработки. Пожалуйста, добавьте фотографии.",
    entityType: "PLACE",
    entityId: "test-place-2",
  });

  const notification3 = await createNotification({
    userId: businessUser.id,
    type: "WELCOME",
    title: WELCOME_NOTIFICATION_TITLE,
    body: WELCOME_NOTIFICATION_BODY,
    isPinned: true,
  });

  console.log(`✅ Created 3 test notifications\n`);

  // Get unread count
  const unreadCount = await prisma.notification.count({
    where: {
      userId: businessUser.id,
      isRead: false,
    },
  });

  console.log(`📊 Unread notifications: ${unreadCount}\n`);

  // Get all notifications
  const allNotifications = await prisma.notification.findMany({
    where: {
      userId: businessUser.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log(`📋 Recent notifications (${allNotifications.length}):`);
  allNotifications.forEach((n, i) => {
    console.log(`   ${i + 1}. ${n.isRead ? "✓" : "○"} ${n.title}`);
    console.log(`      ${n.body.substring(0, 60)}...`);
  });

  console.log("\n✅ Notification UI test complete!");
  console.log("\n📱 To test in browser:");
  console.log(`   1. Login as: ${businessUser.email}`);
  console.log(`   2. Look for notification bell in header (top right)`);
  console.log(`   3. Click bell to see notifications dropdown`);
  console.log(`   4. Visit /business/notifications for full page`);
  console.log(`   5. Test marking as read and filtering`);
}

testNotificationUI()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
