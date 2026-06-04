/**
 * Одноразовый бэкфилл business-broadcast уведомлений.
 * Создаёт недостающие Notification для опубликованных AdminBroadcast,
 * которые должны быть видны в business inbox/dashboard.
 *
 * Запуск:
 *   pnpm tsx prisma/scripts/backfill-business-broadcast-notifications.ts
 */

import {
  AudienceType,
  BroadcastStatus,
  BusinessMemberRole,
  NotificationAudience,
  NotificationType,
  PrismaClient,
  Role,
} from "@prisma/client";

const prisma = new PrismaClient();

function broadcastTypeToNotificationType(type: "NEWS" | "ANNOUNCEMENT" | "SYSTEM"): NotificationType {
  switch (type) {
    case "NEWS":
      return NotificationType.NEWS;
    case "ANNOUNCEMENT":
      return NotificationType.ANNOUNCEMENT;
    case "SYSTEM":
      return NotificationType.SYSTEM;
  }
}

async function resolveBusinessRecipientIds(): Promise<string[]> {
  const [members, businesses, legacyOwners] = await Promise.all([
    prisma.businessMember.findMany({
      where: {
        isActive: true,
        role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
      },
      select: { userId: true },
    }),
    prisma.business.findMany({
      select: { ownerUserId: true },
    }),
    prisma.user.findMany({
      where: { role: Role.BUSINESS_OWNER },
      select: { id: true },
    }),
  ]);

  return [...new Set([
    ...members.map((item) => item.userId),
    ...businesses.map((item) => item.ownerUserId),
    ...legacyOwners.map((item) => item.id),
  ])];
}

async function main() {
  const broadcasts = await prisma.adminBroadcast.findMany({
    where: {
      status: BroadcastStatus.PUBLISHED,
      audienceType: AudienceType.BUSINESS,
      showInInbox: true,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      body: true,
      ctaLabel: true,
      ctaUrl: true,
      pinToDashboard: true,
      type: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  if (broadcasts.length === 0) {
    console.log("No published BUSINESS broadcasts found — nothing to backfill.");
    return;
  }

  const recipientIds = await resolveBusinessRecipientIds();
  if (recipientIds.length === 0) {
    console.log("No business recipients found — nothing to backfill.");
    return;
  }

  let createdTotal = 0;

  for (const broadcast of broadcasts) {
    const existing = await prisma.notification.findMany({
      where: {
        userId: { in: recipientIds },
        entityType: "BROADCAST",
        entityId: broadcast.id,
      },
      select: { userId: true },
    });

    const existingUserIds = new Set(existing.map((item) => item.userId));
    const missingRecipientIds = recipientIds.filter((userId) => !existingUserIds.has(userId));

    if (missingRecipientIds.length === 0) {
      continue;
    }

    const bodySnapshot = broadcast.summary?.trim()
      ? broadcast.summary
      : broadcast.body.slice(0, 500);

    const result = await prisma.notification.createMany({
      data: missingRecipientIds.map((userId) => ({
        userId,
        audience: NotificationAudience.BUSINESS,
        type: broadcastTypeToNotificationType(broadcast.type),
        title: broadcast.title,
        body: bodySnapshot,
        ctaLabel: broadcast.ctaLabel ?? null,
        ctaAction: broadcast.ctaUrl ?? null,
        isPinned: broadcast.pinToDashboard,
        entityType: "BROADCAST",
        entityId: broadcast.id,
      })),
    });

    createdTotal += result.count;
    console.log(
      `Broadcast ${broadcast.id}: created ${result.count} missing notifications`,
    );
  }

  console.log(`Backfill complete. Notifications created: ${createdTotal}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
