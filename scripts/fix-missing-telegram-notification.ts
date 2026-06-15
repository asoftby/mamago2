#!/usr/bin/env tsx
/**
 * One-time fix: create CONNECT_TELEGRAM onboarding notification for users who lack it.
 *
 * Usage:
 *   pnpm tsx scripts/fix-missing-telegram-notification.ts
 *
 * Safe to re-run — ensureOnboardingNotification is idempotent (checks for existing record).
 * Skips users who already have Telegram connected.
 */

import prisma from "../src/lib/prisma";

async function main() {
  // Find all users who:
  //   a) don't already have a non-archived CONNECT_TELEGRAM onboarding notification
  //   b) don't have Telegram connected
  const usersWithoutTelegram = await prisma.user.findMany({
    where: {
      // No active Telegram connection
      telegramConnections: { none: {} },
    },
    select: { id: true },
  });

  if (usersWithoutTelegram.length === 0) {
    console.log("No users without Telegram found. Nothing to do.");
    return;
  }

  console.log(`Found ${usersWithoutTelegram.length} users without Telegram. Checking each...`);

  let created = 0;
  let skipped = 0;

  for (const user of usersWithoutTelegram) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        audience: "USER",
        type: "SYSTEM",
        entityType: null,
        entityId: "CONNECT_TELEGRAM",
        archivedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.notification.create({
      data: {
        userId: user.id,
        audience: "USER",
        type: "SYSTEM",
        title: "Подключите Telegram",
        body: "Получайте уведомления о заявках, планах и событиях прямо в Telegram.",
        ctaLabel: "Подключить",
        ctaAction: "/me/settings/notifications",
        actionMode: "PAGE",
        actionUrl: "/me/settings/notifications",
        isPinned: true,
        entityId: "CONNECT_TELEGRAM",
        metadata: { kind: "CONNECT_TELEGRAM" },
      },
    });

    created++;
  }

  console.log(`Done. Created: ${created}, already had it: ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
